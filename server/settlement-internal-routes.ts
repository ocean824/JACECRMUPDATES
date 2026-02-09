import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { investors, settlementSessions } from "@shared/schema";
import { storage, logAudit } from "./storage";
import { renderSettlementReceiptPdf } from "./lib/pdf/renderSettlementReceiptPdf";
import { sendWebhookToBondAI } from "./services/bondaiSettlementWebhook";

const UPLOAD_DIR = "./uploads";

function getUserId(req: Request): string {
  const user = (req as any).user as any;
  return user?.claims?.sub;
}

async function requireInternalRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const userSession = (req.session as any)?.user;
    if (userSession?.isAdmin === "true") return next();

    const role = await storage.getUserRole(userId);
    const allowed = new Set(["admin", "accounting", "ops", "investor_relations"]);

    if (!role?.role || !allowed.has(role.role)) {
      return res.status(403).json({ message: "Internal access required" });
    }

    return next();
  } catch (err) {
    console.error("Internal role check failed:", err);
    return res.status(500).json({ message: "Role check failed" });
  }
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export function registerInternalSettlementRoutes(app: Express, isAuthenticated: any) {
  // Internal settlement inbox and actions (requires login + internal role)
  app.get("/api/admin/settlements/summary", isAuthenticated, requireInternalRole, async (_req, res) => {
    try {
      const [submittedRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(settlementSessions)
        .where(eq(settlementSessions.status, "submitted"));

      const [pendingRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(settlementSessions)
        .where(eq(settlementSessions.status, "pending"));

      res.json({
        submittedCount: Number(submittedRow?.count || 0),
        pendingCount: Number(pendingRow?.count || 0),
      });
    } catch (error) {
      console.error("Error fetching settlement summary:", error);
      res.status(500).json({ message: "Failed to fetch settlement summary" });
    }
  });

  app.get("/api/admin/settlements", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10) || 50, 200) : 50;

      const base = db.select().from(settlementSessions);
      const rows = status
        ? await base.where(eq(settlementSessions.status, status)).orderBy(desc(settlementSessions.createdAt)).limit(limit)
        : await base.orderBy(desc(settlementSessions.createdAt)).limit(limit);

      res.json(rows);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      res.status(500).json({ message: "Failed to fetch settlements" });
    }
  });

  app.post("/api/admin/settlements/:sessionId/confirm", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.sessionId;
      const notes = typeof req.body?.notes === "string" ? req.body.notes : null;

      const [existing] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Settlement session not found" });

      if (existing.status === "settled") {
        return res.status(400).json({ message: "Settlement is already confirmed" });
      }
      if (existing.status === "cancelled") {
        return res.status(400).json({ message: "Settlement is cancelled" });
      }
      if (existing.status !== "submitted") {
        return res.status(400).json({ message: "Settlement has not been submitted yet" });
      }

      // Mark settled
      const now = new Date();
      const [updated] = await db
        .update(settlementSessions)
        .set({
          status: "settled",
          settledAt: now,
          updatedAt: now,
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

      // Generate receipt PDF
      ensureUploadDir();
      const receiptId = `REC-${now.getTime()}-${sessionId.slice(0, 8)}`;
      const receiptBuffer = await renderSettlementReceiptPdf({
        receiptId,
        sessionId,
        tradeId: updated.tradeId,
        bondName: updated.bondName,
        bondId: updated.bondId,
        investorEmail: updated.investorEmail,
        amount: Number(updated.amount),
        paymentReference: updated.paymentReference,
        confirmedAtISO: now.toISOString(),
        confirmedByUserId: userId,
        notes,
      });

      const receiptFilename = `settlement-receipt-${sessionId}.pdf`;
      const receiptPath = path.join(UPLOAD_DIR, receiptFilename);
      fs.writeFileSync(receiptPath, receiptBuffer);

      // Attempt to attach receipt to investor record (best-effort)
      let investorId: string | null = updated.investorId ?? null;
      if (!investorId && updated.investorEmail) {
        const [inv] = await db
          .select()
          .from(investors)
          .where(sql`lower(${investors.email}) = lower(${updated.investorEmail})`)
          .orderBy(desc(investors.createdAt))
          .limit(1);
        investorId = inv?.id ?? null;
      }

      // Create a document record for download links in the CRM
      try {
        await storage.createDocument(userId, {
          filename: receiptFilename,
          originalName: `Settlement Receipt - Trade ${updated.tradeId}.pdf`,
          mimeType: "application/pdf",
          size: receiptBuffer.length,
          investorId,
          category: "settlement_receipt",
          description: `Settlement receipt for Trade ${updated.tradeId} (Session ${sessionId})`,
        });
      } catch (err) {
        console.error("Failed to create settlement receipt document record:", err);
      }

      // Audit log
      await logAudit(
        userId,
        "update",
        "settlement_session",
        sessionId,
        `Confirmed settlement for Trade ${updated.tradeId}`,
        {
          tradeId: updated.tradeId,
          amount: updated.amount,
          paymentReference: updated.paymentReference,
          receiptId,
          notes,
        },
        req.ip
      );

      // Notify BondAI (ONLY after internal confirmation)
      const settlementBondaiBase = (process.env.BONDAI_API_URL || process.env.BONDAI_WEBHOOK_URL || "").replace(/\/+$/, "").replace(/\/api\/.*$/, "");
      const webhookUrl = settlementBondaiBase ? `${settlementBondaiBase}/api/jace/webhook` : null;
      const webhookSecret = process.env.JACE_WEBHOOK_SECRET || process.env.BONDAI_WEBHOOK_SECRET;
      let webhookResult: any = null;

      if (webhookUrl && webhookSecret) {
        webhookResult = await sendWebhookToBondAI(webhookUrl, webhookSecret, "settlement.completed", {
          tradeId: updated.tradeId,
          sessionId,
          investorEmail: updated.investorEmail,
          amount: updated.amount,
          paymentReference: updated.paymentReference,
          receiptId,
          receiptUrl: `/api/admin/settlements/${sessionId}/receipt`,
        });
      } else {
        console.error(`[JACE WEBHOOK] Settlement webhook SKIPPED — webhookUrl=${webhookUrl || "NULL"}, secret present=${!!webhookSecret}. Set BONDAI_API_URL and JACE_WEBHOOK_SECRET.`);
      }

      res.json({
        success: true,
        session: updated,
        receiptId,
        receiptUrl: `/api/admin/settlements/${sessionId}/receipt`,
        webhook: webhookResult,
      });
    } catch (error) {
      console.error("Error confirming settlement:", error);
      res.status(500).json({ message: "Failed to confirm settlement" });
    }
  });

  app.post("/api/admin/settlements/:sessionId/cancel", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.sessionId;
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "Cancelled by internal user";

      const [existing] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Settlement session not found" });

      if (existing.status === "settled") {
        return res.status(400).json({ message: "Cannot cancel a confirmed settlement" });
      }
      if (existing.status === "cancelled") {
        return res.status(400).json({ message: "Settlement is already cancelled" });
      }

      const now = new Date();
      const [updated] = await db
        .update(settlementSessions)
        .set({
          status: "cancelled",
          cancelledAt: now,
          failureReason: reason,
          updatedAt: now,
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

      await logAudit(
        userId,
        "update",
        "settlement_session",
        sessionId,
        `Cancelled settlement for Trade ${updated.tradeId}`,
        { tradeId: updated.tradeId, reason },
        req.ip
      );

      res.json({ success: true, session: updated });
    } catch (error) {
      console.error("Error cancelling settlement:", error);
      res.status(500).json({ message: "Failed to cancel settlement" });
    }
  });

  app.get("/api/admin/settlements/:sessionId/receipt", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const receiptFilename = `settlement-receipt-${sessionId}.pdf`;
      const receiptPath = path.join(UPLOAD_DIR, receiptFilename);
      if (!fs.existsSync(receiptPath)) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=\"${receiptFilename}\"`);
      fs.createReadStream(receiptPath).pipe(res);
    } catch (error) {
      console.error("Error downloading settlement receipt:", error);
      res.status(500).json({ message: "Failed to download receipt" });
    }
  });
}
