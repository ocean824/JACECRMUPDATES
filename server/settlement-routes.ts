import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { desc, eq, sql } from "drizzle-orm";
import { investors, settlementSessions } from "@shared/schema";
import { logAudit } from "./storage";

export interface SettlementJwtPayload {
  sid: string;
  tradeId: number;
  bondId?: number;
  investorId?: number; // BondAI investor id
  amount: number;
  bondName?: string;
  investorEmail?: string;
  exp: number;
  iat?: number;
}

function settlementSecretOrThrow(): string {
  const v = process.env.SETTLEMENT_JWT_SECRET || process.env.BONDAI_SETTLEMENT_SECRET;
  if (!v) throw new Error("SETTLEMENT_JWT_SECRET (or BONDAI_SETTLEMENT_SECRET) is required");
  return v;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded) && forwarded.length > 0) return forwarded[0].split(",")[0].trim();
  return req.ip || "unknown";
}

function getUserAgent(req: Request): string {
  return (req.headers["user-agent"] as string) || "unknown";
}

function setFrameAncestorsHeaders(res: Response) {
  const fa = process.env.BONDAI_ALLOWED_FRAME_ANCESTORS;
  if (fa) {
    res.setHeader("Content-Security-Policy", `frame-ancestors ${fa};`);
  }
}

function verifySettlementJwt(token: string, secret: string): SettlementJwtPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as SettlementJwtPayload;
    if (!decoded.sid || typeof decoded.tradeId !== "number" || typeof decoded.amount !== "number") {
      throw new Error("Invalid token claims");
    }
    return decoded;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") throw new Error("Token expired");
    if (err?.name === "JsonWebTokenError") throw new Error("Invalid token signature");
    throw new Error(err?.message || "Token verification failed");
  }
}

function signSettlementJwt(
  payload: Omit<SettlementJwtPayload, "exp" | "iat">,
  secret: string,
  expiresInSeconds: number
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const full: SettlementJwtPayload = {
    ...(payload as any),
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
  };
  return jwt.sign(full, secret, { algorithm: "HS256" });
}

function requireBondAISecret(req: Request): { ok: boolean; reason?: string } {
  const expected = process.env.BONDAI_WEBHOOK_SECRET;
  const provided = (req.headers["x-bondai-webhook-secret"] as string) || (req.headers["x-api-key"] as string);

  // If no secret is configured, don't block (dev mode)
  if (!expected) return { ok: true, reason: "No BONDAI_WEBHOOK_SECRET configured" };
  if (!provided) return { ok: false, reason: "Missing BondAI secret header" };
  return provided === expected ? { ok: true } : { ok: false, reason: "Invalid BondAI secret" };
}

export function registerSettlementRoutes(app: Express) {
  // Allow iframe embedding from BondAI
  app.use((req, res, next) => {
    if (req.path === "/settlement" || req.path.startsWith("/settlement/") || req.path.startsWith("/api/settlement")) {
      setFrameAncestorsHeaders(res);
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  /**
   * External: BondAI calls this to create a settlement session + signed token.
   * The token is then used by BondAI to open the settlement popup/iframe:
   *   /settlement?session=<token>
   */
  app.post("/api/external/settlement/session", async (req: Request, res: Response) => {
    try {
      const auth = requireBondAISecret(req);
      if (!auth.ok) return res.status(401).json({ message: auth.reason || "Unauthorized" });

      const secret = settlementSecretOrThrow();

      const tradeId = Number(req.body?.tradeId);
      const amount = Number(req.body?.amount);
      const bondId = req.body?.bondId != null ? Number(req.body?.bondId) : undefined;
      const investorId = req.body?.investorId != null ? Number(req.body?.investorId) : undefined;
      const bondName = typeof req.body?.bondName === "string" ? req.body.bondName : undefined;
      const investorEmail = typeof req.body?.investorEmail === "string" ? req.body.investorEmail : undefined;

      if (!Number.isFinite(tradeId) || tradeId <= 0) return res.status(400).json({ message: "Invalid tradeId" });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

      // Best-effort: match to an existing investor record by email
      let matchedInvestorId: string | null = null;
      let matchedInvestorName: string | null = null;

      if (investorEmail) {
        const [inv] = await db
          .select()
          .from(investors)
          .where(sql`lower(${investors.email}) = lower(${investorEmail})`)
          .orderBy(desc(investors.createdAt))
          .limit(1);
        if (inv) {
          matchedInvestorId = inv.id;
          matchedInvestorName = `${inv.firstName} ${inv.lastName}`.trim();
        }
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);

      const [inserted] = await db
        .insert(settlementSessions)
        .values({
          sessionId,
          tradeId,
          bondId: bondId ?? null,
          bondaiInvestorId: investorId ?? null,
          investorId: matchedInvestorId,
          investorName: matchedInvestorName,
          investorEmail: investorEmail ?? null,
          ipAddress,
          userAgent,
          amount: amount.toString(),
          bondName: bondName ?? null,
          status: "pending",
          expiresAt,
        })
        .returning();

      const token = signSettlementJwt(
        {
          sid: sessionId,
          tradeId,
          amount,
          bondId,
          investorId,
          bondName,
          investorEmail,
        },
        secret,
        60 * 60 // 1 hour
      );

      const origin = `${req.protocol}://${req.get("host")}`;
      res.json({
        sessionId,
        token,
        settlementUrl: `${origin}/settlement?session=${encodeURIComponent(token)}`,
        createdAt: inserted?.createdAt?.toISOString?.() ?? new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err: any) {
      console.error("Failed to create settlement session:", err);
      res.status(500).json({ message: err?.message || "Failed to create settlement session" });
    }
  });

  /**
   * Investor-facing: validates a settlement token and returns session info.
   */
  app.get("/api/settlement/session", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: "Missing token" });
      }

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [existing] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      // Best-effort: match to investor by email (for internal document linkage)
      let matchedInvestorId: string | null = existing?.investorId ?? null;
      let matchedInvestorName: string | null = existing?.investorName ?? null;
      if ((!matchedInvestorId || !matchedInvestorName) && payload.investorEmail) {
        const [inv] = await db
          .select()
          .from(investors)
          .where(sql`lower(${investors.email}) = lower(${payload.investorEmail})`)
          .orderBy(desc(investors.createdAt))
          .limit(1);
        if (inv) {
          matchedInvestorId = inv.id;
          matchedInvestorName = `${inv.firstName} ${inv.lastName}`.trim();
        }
      }

      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);
      const expDate = new Date(payload.exp * 1000);

      if (existing) {
        const [updated] = await db
          .update(settlementSessions)
          .set({
            tradeId: payload.tradeId,
            bondId: payload.bondId ?? null,
            bondaiInvestorId: payload.investorId ?? null,
            investorEmail: payload.investorEmail ?? existing.investorEmail,
            investorId: matchedInvestorId,
            investorName: matchedInvestorName,
            ipAddress,
            userAgent,
            amount: payload.amount.toString(),
            bondName: payload.bondName ?? existing.bondName,
            expiresAt: expDate,
            updatedAt: new Date(),
          })
          .where(eq(settlementSessions.sessionId, payload.sid))
          .returning();

        return res.json({
          sessionId: updated.sessionId,
          tradeId: updated.tradeId,
          bondId: updated.bondId,
          investorEmail: updated.investorEmail,
          amount: Number(updated.amount),
          bondName: updated.bondName,
          status: updated.status,
          paymentReference: updated.paymentReference,
          createdAt: updated.createdAt?.toISOString?.() ?? null,
          expiresAt: updated.expiresAt?.toISOString?.() ?? expDate.toISOString(),
        });
      }

      // If not existing, create it (BondAI may have generated token itself)
      const [created] = await db
        .insert(settlementSessions)
        .values({
          sessionId: payload.sid,
          tradeId: payload.tradeId,
          bondId: payload.bondId ?? null,
          bondaiInvestorId: payload.investorId ?? null,
          investorId: matchedInvestorId,
          investorName: matchedInvestorName,
          investorEmail: payload.investorEmail ?? null,
          ipAddress,
          userAgent,
          amount: payload.amount.toString(),
          bondName: payload.bondName ?? null,
          status: "pending",
          expiresAt: expDate,
        })
        .returning();

      res.json({
        sessionId: payload.sid,
        tradeId: payload.tradeId,
        bondId: payload.bondId ?? null,
        investorEmail: payload.investorEmail ?? null,
        amount: payload.amount,
        bondName: payload.bondName ?? null,
        status: "pending",
        paymentReference: null,
        createdAt: created?.createdAt?.toISOString?.() ?? new Date().toISOString(),
        expiresAt: expDate.toISOString(),
      });
    } catch (error: any) {
      console.error("Settlement session error:", error);
      res.status(400).json({ message: error?.message || "Invalid settlement session" });
    }
  });

  /**
   * Investor-facing: records payment reference + marks session as SUBMITTED.
   * IMPORTANT: This does NOT confirm settlement and does NOT call BondAI.
   * BondAI callback is triggered ONLY after internal confirmation.
   */
  app.post("/api/settlement/complete", async (req: Request, res: Response) => {
    try {
      const token = req.body?.token as string;
      const paymentReference = (req.body?.paymentReference as string) || null;

      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Settlement session not found" });
      if (session.status === "settled") return res.status(400).json({ message: "This settlement is already confirmed" });
      if (session.status === "cancelled") return res.status(400).json({ message: "This settlement has been cancelled" });

      const now = new Date();
      const [updated] = await db
        .update(settlementSessions)
        .set({
          status: "submitted",
          paymentReference,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
          updatedAt: now,
        })
        .where(eq(settlementSessions.sessionId, payload.sid))
        .returning();

      // Audit log (system scoped to this sessionId)
      try {
        await logAudit(
          "system",
          "update",
          "settlement_session",
          payload.sid,
          `Settlement submitted for Trade ${updated.tradeId}`,
          { tradeId: updated.tradeId, amount: updated.amount, paymentReference },
          getClientIp(req)
        );
      } catch {
        // no-op
      }

      res.json({
        success: true,
        status: updated.status,
        message: "Settlement request submitted. JACE will confirm after escrow verification.",
      });
    } catch (error: any) {
      console.error("Settlement complete error:", error);
      res.status(400).json({ message: error?.message || "Failed to submit settlement" });
    }
  });

  /**
   * Investor-facing: cancels a settlement request before internal confirmation.
   */
  app.post("/api/settlement/cancel", async (req: Request, res: Response) => {
    try {
      const token = req.body?.token as string;
      const reason = (req.body?.reason as string) || "Cancelled by investor";

      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Settlement session not found" });
      if (session.status === "settled") return res.status(400).json({ message: "This settlement is already confirmed" });

      const now = new Date();
      await db
        .update(settlementSessions)
        .set({
          status: "cancelled",
          cancelledAt: now,
          failureReason: reason,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
          updatedAt: now,
        })
        .where(eq(settlementSessions.sessionId, payload.sid));

      // Audit log (best-effort)
      try {
        await logAudit(
          "system",
          "update",
          "settlement_session",
          payload.sid,
          `Settlement cancelled for Trade ${payload.tradeId}`,
          { tradeId: payload.tradeId, reason },
          getClientIp(req)
        );
      } catch {
        // no-op
      }

      res.json({ success: true, message: "Settlement cancelled" });
    } catch (error: any) {
      console.error("Settlement cancel error:", error);
      res.status(400).json({ message: error?.message || "Failed to cancel settlement" });
    }
  });

  // NOTE: Internal confirmation/cancellation lives in /api/admin/settlements/*
}
