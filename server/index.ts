import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebhookHandlers } from "./webhookHandlers";
import { registerAgentRoutes } from "./routes/agentRoutes";
import { initAgentRegistry } from "./agents";
import { isLocalAuthenticated } from "./local-auth";
import { startOutboxDispatcher } from "./jobs/webhookOutboxDispatcher";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: "Invalid webhook payload" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        console.error("STRIPE_WEBHOOK_SECRET not configured, rejecting unverified webhook");
        return res.status(400).json({ error: "Webhook secret not configured" });
      }

      const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      if (event && event.type) {
        const paymentIntent = event.data?.object;
        if (event.type === "payment_intent.succeeded" && paymentIntent) {
          await WebhookHandlers.handlePaymentIntentSucceeded(paymentIntent);
        } else if (event.type === "payment_intent.payment_failed" && paymentIntent) {
          await WebhookHandlers.handlePaymentIntentFailed(paymentIntent);
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error.message);
      res.status(400).json({ error: "Webhook signature verification failed" });
    }
  }
);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid request body" });
  }
  next(err);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

let stripeInitStatus = { migrated: false, tables: 0, migrations: 0, error: null as string | null, startedAt: new Date().toISOString() };

(async () => {
  try {
    const { runMigrations } = await import("stripe-replit-sync");
    const { getStripeSync } = await import("./stripeClient");
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      console.log("Initializing Stripe schema...");
      console.log(`DATABASE_URL present: ${!!databaseUrl}, length: ${databaseUrl.length}`);

      // Pre-create Stripe enum types that migrations expect
      // This fixes production issues where the enum type check in migrations
      // fails due to schema search path differences
      try {
        const { Pool } = await import("pg");
        const prePool = new Pool({ connectionString: databaseUrl, max: 1 });
        await prePool.query(`CREATE SCHEMA IF NOT EXISTS stripe`);
        const enumTypes = [
          { name: 'invoice_status', values: "'draft', 'open', 'paid', 'uncollectible', 'void'" },
          { name: 'subscription_status', values: "'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'" },
          { name: 'dispute_status', values: "'warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'won', 'lost'" },
          { name: 'payout_status', values: "'paid', 'pending', 'in_transit', 'canceled', 'failed'" },
        ];
        for (const et of enumTypes) {
          try {
            await prePool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = '${et.name}' AND n.nspname = 'stripe') THEN CREATE TYPE "stripe"."${et.name}" AS ENUM (${et.values}); END IF; END $$;`);
          } catch (enumErr: any) {
            console.log(`Enum ${et.name} pre-creation note:`, enumErr.message);
          }
        }
        await prePool.end();
        console.log("Pre-created Stripe enum types");
      } catch (preErr: any) {
        console.log("Enum pre-creation skipped:", preErr.message);
      }

      await runMigrations({ databaseUrl });
      console.log("Stripe schema ready");

      // Count stripe tables and migrations for diagnostics
      try {
        const { Pool } = await import("pg");
        const pool = new Pool({ connectionString: databaseUrl, max: 1 });
        const tableRes = await pool.query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'stripe' AND table_type = 'BASE TABLE'");
        const migRes = await pool.query("SELECT COUNT(*) FROM stripe._migrations");
        stripeInitStatus.tables = parseInt(tableRes.rows[0].count);
        stripeInitStatus.migrations = parseInt(migRes.rows[0].count);
        stripeInitStatus.migrated = true;
        console.log(`Stripe diagnostics: ${stripeInitStatus.tables} tables, ${stripeInitStatus.migrations} migrations applied`);
        await pool.end();
      } catch (diagErr: any) {
        console.log("Stripe diagnostics query failed:", diagErr.message);
      }

      const stripeSync = await getStripeSync();
      const replitDomains = process.env.REPLIT_DOMAINS;
      if (replitDomains) {
        const webhookBaseUrl = `https://${replitDomains.split(",")[0]}`;
        try {
          const result = await stripeSync.findOrCreateManagedWebhook(
            `${webhookBaseUrl}/api/stripe/webhook`
          );
          if (result?.webhook) {
            console.log(`Stripe webhook configured: ${result.webhook.url}`);
          } else {
            console.log("Stripe webhook setup returned no webhook, continuing...");
          }
        } catch (whErr: any) {
          console.log("Stripe webhook setup skipped:", whErr.message);
        }
      } else {
        console.log("REPLIT_DOMAINS not set, skipping webhook setup");
      }
      stripeSync.syncBackfill()
        .then(() => console.log("Stripe data synced"))
        .catch((err: any) => console.error("Error syncing Stripe data:", err));
    } else {
      stripeInitStatus.error = "DATABASE_URL not set";
      console.error("DATABASE_URL not set, cannot initialize Stripe");
    }
  } catch (error: any) {
    stripeInitStatus.error = error.message;
    console.error("Failed to initialize Stripe:", error.message);
    console.error("Full error:", error.stack || error);
  }

  app.get("/api/health/stripe", isLocalAuthenticated, (req, res) => {
    res.json({
      status: stripeInitStatus.migrated ? "ok" : "error",
      error: stripeInitStatus.error,
    });
  });

  app.get("/api/download/updates-log", (_req, res) => {
    const filePath = path.resolve("JACE_CRM_Updates_Log.docx");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    res.download(filePath, "JACE_CRM_Updates_Log.docx");
  });

  await registerRoutes(httpServer, app);

  try {
    const bcrypt = await import("bcryptjs");
    const { db } = await import("./db");
    const { users, userRoles, escrowAccounts, accounts } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");

    const seedEmail = "admin1@jacemgmtllc.com";
    const [existing] = await db.select().from(users).where(eq(users.email, seedEmail)).limit(1);
    if (!existing) {
      const hashedPw = await bcrypt.default.hash("Theadmin12726", 12);
      const [newUser] = await db.insert(users).values({
        email: seedEmail,
        firstName: "Admin",
        lastName: "One",
        password: hashedPw,
        isAdmin: "true",
      }).returning();
      await db.insert(userRoles).values({ userId: newUser.id, role: "admin" });
      console.log(`Seeded admin user: ${seedEmail}`);
    } else {
      const [existingRole] = await db.select().from(userRoles).where(eq(userRoles.userId, existing.id)).limit(1);
      if (!existingRole) {
        await db.insert(userRoles).values({ userId: existing.id, role: "admin" });
        console.log(`Added admin role for existing user: ${seedEmail}`);
      }
    }

    const envAdminId = "env-admin-001";
    const [envAdminRole] = await db.select().from(userRoles).where(eq(userRoles.userId, envAdminId)).limit(1);
    if (!envAdminRole) {
      await db.insert(userRoles).values({ userId: envAdminId, role: "admin" });
      console.log(`Seeded admin role for env-admin: ${envAdminId}`);
    }

    const adminUsers = await db.select().from(users).where(eq(users.isAdmin, "true"));
    for (const adminUser of adminUsers) {
      const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, adminUser.id)).limit(1);
      if (!role) {
        await db.insert(userRoles).values({ userId: adminUser.id, role: "admin" });
        console.log(`Seeded admin role for user: ${adminUser.email}`);
      }
    }

    const seedUserIds = new Set<string>();
    if (existing?.id) seedUserIds.add(existing.id);
    seedUserIds.add(envAdminId);
    for (const adminUser of adminUsers) {
      seedUserIds.add(adminUser.id);
    }

    for (const seedUserId of seedUserIds) {

    const [existingEscrow] = await db.select().from(escrowAccounts).where(eq(escrowAccounts.userId, seedUserId)).limit(1);
    if (!existingEscrow) {
      await db.insert(escrowAccounts).values({
        userId: seedUserId,
        accountName: "Primary Escrow Account",
        bankName: "DUMMY BANK",
        accountType: "checking",
        accountNumberLast4: "0000",
        routingNumberLast4: "0000",
        balance: "0",
        currency: "USD",
        isActive: true,
        isDefault: true,
        notes: "Default escrow account (dummy placeholder)",
      });
      console.log(`Seeded default escrow account for user: ${seedUserId}`);
    }

    const defaultAccounts = [
      { code: "1000", name: "Cash", accountType: "asset" as const },
      { code: "1100", name: "Accounts Receivable", accountType: "asset" as const },
      { code: "2000", name: "Accounts Payable", accountType: "liability" as const },
      { code: "3000", name: "Owner's Equity", accountType: "equity" as const },
      { code: "4000", name: "Revenue", accountType: "revenue" as const },
      { code: "5000", name: "Operating Expenses", accountType: "expense" as const },
      { code: "5100", name: "Cost of Goods Sold", accountType: "expense" as const },
    ];
    for (const acct of defaultAccounts) {
      const [existingAcct] = await db.select().from(accounts).where(
        and(eq(accounts.userId, seedUserId), eq(accounts.code, acct.code))
      ).limit(1);
      if (!existingAcct) {
        await db.insert(accounts).values({
          userId: seedUserId,
          code: acct.code,
          name: acct.name,
          accountType: acct.accountType,
          balance: "0",
          isActive: true,
        });
        console.log(`Seeded account: ${acct.code} ${acct.name} for ${seedUserId}`);
      }
    }

    } // end for-of seedUserIds
  } catch (seedErr: any) {
    console.error("Admin seed failed:", seedErr.message);
  }

  try {
    initAgentRegistry();
    registerAgentRoutes(app, isLocalAuthenticated);
    console.log("Agent runtime registered successfully");
  } catch (agentErr: any) {
    console.error("Failed to initialize agent runtime:", agentErr.message);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      startOutboxDispatcher();
    },
  );
})();
