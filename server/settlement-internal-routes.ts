import type { Express, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { documents, investors, settlementCompliance, settlementSessions } from "@shared/schema";
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

      const baseQuery = db
        .select({
          id: settlementSessions.id,
          sessionId: settlementSessions.sessionId,
          tradeId: settlementSessions.tradeId,
          bondId: settlementSessions.bondId,
          bondaiInvestorId: settlementSessions.bondaiInvestorId,
          investorId: settlementSessions.investorId,
          investorName: settlementSessions.investorName,
          investorEmail: settlementSessions.investorEmail,
          amount: settlementSessions.amount,
          bondName: settlementSessions.bondName,
          paymentReference: settlementSessions.paymentReference,
          status: settlementSessions.status,
          complianceStatus: settlementSessions.complianceStatus,
          complianceCompletedAt: settlementSessions.complianceCompletedAt,
          createdAt: settlementSessions.createdAt,
          updatedAt: settlementSessions.updatedAt,
          expiresAt: settlementSessions.expiresAt,
          settledAt: settlementSessions.settledAt,
          cancelledAt: settlementSessions.cancelledAt,
          failureReason: settlementSessions.failureReason,
          escrowAccountId: settlementSessions.escrowAccountId,

          entityType: settlementCompliance.entityType,
          entityLegalName: settlementCompliance.entityLegalName,
          taxIdType: settlementCompliance.taxIdType,
          taxIdLast4: settlementCompliance.taxIdLast4,
          idPrimaryDocumentId: settlementCompliance.idPrimaryDocumentId,
          idSecondaryDocumentId: settlementCompliance.idSecondaryDocumentId,
          creditReportDocumentId: settlementCompliance.creditReportDocumentId,
          creditProvider: settlementCompliance.creditProvider,
          creditReference: settlementCompliance.creditReference,
          creditStatus: settlementCompliance.creditStatus,
          authorizationSignedAt: settlementCompliance.authorizationSignedAt,

          compliancePacketDocumentId: sql<string | null>`(
            select id
            from documents
            where category = 'settlement_compliance'
              and filename = ('settlement-compliance-' || ${settlementSessions.sessionId} || '.pdf')
            limit 1
          )`,
        })
        .from(settlementSessions)
        .leftJoin(settlementCompliance, eq(settlementCompliance.sessionId, settlementSessions.sessionId));

      const rows = status
        ? await baseQuery.where(eq(settlementSessions.status, status)).orderBy(desc(settlementSessions.createdAt)).limit(limit)
        : await baseQuery.orderBy(desc(settlementSessions.createdAt)).limit(limit);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      res.status(500).json({ message: "Failed to fetch settlements" });
    }
  });

  app.get("/api/admin/documents/:id/download", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const id = req.params.id;
      const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const filePath = path.join(UPLOAD_DIR, doc.filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

      return res.download(filePath, doc.originalName);
    } catch (error) {
      console.error("Error downloading admin document:", error);
      return res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.post("/api/admin/settlements/:sessionId/confirm", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.sessionId;
      const notes = typeof req.body?.notes === "string" ? req.body.notes : null;
      const escrowAccountId = typeof req.body?.escrowAccountId === "string" ? req.body.escrowAccountId : null;

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

      if (existing.complianceStatus !== "complete") {
        return res.status(409).json({
          message:
            "Cannot confirm settlement: investor compliance gate is incomplete (entity + 2 IDs + tri-merge credit authorization + attestations).",
        });
      }

      const now = new Date();
      const [updated] = await db
        .update(settlementSessions)
        .set({
          status: "settled",
          settledAt: now,
          updatedAt: now,
          ...(escrowAccountId ? { escrowAccountId } : {}),
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

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

      const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
      const webhookSecret = process.env.BONDAI_WEBHOOK_SECRET;
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
