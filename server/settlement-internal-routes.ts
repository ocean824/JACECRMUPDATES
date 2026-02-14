import type { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { accounts, assignments, bondSettlements, documents, escrowAccounts, investors, journalEntries, journalEntryLines, settlementCompliance, settlementSessions, webhookOutbox } from "@shared/schema";
import { storage, logAudit } from "./storage";
import { renderSettlementReceiptPdf } from "./lib/pdf/renderSettlementReceiptPdf";


const UPLOAD_DIR = "./uploads";

function getUserId(req: Request): string {
  const user = (req as any).user as any;
  return user?.claims?.sub;
}

async function requireInternalRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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

export async function recalculateAccountBalance(accountId: string, dbInstance: typeof db) {
  const [account] = await dbInstance
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) return;

  const [totals] = await dbInstance
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${journalEntryLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${journalEntryLines.credit}), 0)`,
    })
    .from(journalEntryLines)
    .where(eq(journalEntryLines.accountId, accountId));

  const totalDebit = parseFloat(totals?.totalDebit || "0");
  const totalCredit = parseFloat(totals?.totalCredit || "0");

  let balance: number;
  if (account.accountType === "asset" || account.accountType === "expense") {
    balance = totalDebit - totalCredit;
  } else {
    balance = totalCredit - totalDebit;
  }

  await dbInstance
    .update(accounts)
    .set({ balance: balance.toFixed(2) })
    .where(eq(accounts.id, accountId));
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

          webhookStatus: sql<string | null>`(
            select status
            from webhook_outbox
            where event_key like ('settle:' || ${settlementSessions.sessionId} || '%')
            order by created_at desc
            limit 1
          )`,
          webhookAttemptCount: sql<number | null>`(
            select attempt_count
            from webhook_outbox
            where event_key like ('settle:' || ${settlementSessions.sessionId} || '%')
            order by created_at desc
            limit 1
          )`,
          webhookLastError: sql<string | null>`(
            select last_error
            from webhook_outbox
            where event_key like ('settle:' || ${settlementSessions.sessionId} || '%')
            order by created_at desc
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
      let escrowAccountId = typeof req.body?.escrowAccountId === "string" ? req.body.escrowAccountId : null;

      const [existing] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!existing) return res.status(404).json({ message: "Settlement session not found" });

      if (!escrowAccountId) {
        const [defaultEscrow] = await db
          .select()
          .from(escrowAccounts)
          .where(
            and(
              eq(escrowAccounts.userId, userId),
              eq(escrowAccounts.isDefault, true),
              eq(escrowAccounts.isActive, true)
            )
          )
          .limit(1);
        if (defaultEscrow) {
          escrowAccountId = defaultEscrow.id;
        }
      }

      if (!escrowAccountId) {
        return res.status(400).json({
          message: "No escrow account available. Please create an escrow account and mark it as default before confirming settlements.",
          code: "ESCROW_REQUIRED",
        });
      }

      const [escrow] = await db
        .select()
        .from(escrowAccounts)
        .where(eq(escrowAccounts.id, escrowAccountId))
        .limit(1);
      if (!escrow) {
        return res.status(400).json({ message: "Invalid escrow account" });
      }
      if (escrow.userId && escrow.userId !== userId) {
        return res.status(403).json({ message: "Escrow account access denied" });
      }
      if (!escrow.isActive) {
        return res.status(400).json({ message: "Escrow account is inactive" });
      }

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
          escrowAccountId,
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

      let createdAssignmentId: string | null = null;
      try {
        const assignmentData = {
          userId,
          investorId: updated.investorId || undefined,
          settlementSessionId: updated.id,
          tradeId: updated.tradeId,
          bondId: updated.bondId,
          bondName: updated.bondName,
          issuerName: updated.issuerName,
          assignmentType: updated.assignmentType,
          cusip: updated.cusip,
          maturityDate: updated.maturityDate ? new Date(updated.maturityDate) : undefined,
          couponRate: updated.couponRate,
          unitCount: updated.unitCount,
          unitPrice: updated.unitPrice,
          totalAmount: updated.amount,
          investorName: updated.investorName,
          investorEmail: updated.investorEmail,
          status: "active",
          notes: notes || undefined,
        };
        const createdAssignment = await (storage as any).createAssignment(userId, assignmentData);
        createdAssignmentId = createdAssignment?.id || null;
        console.log(`Auto-created assignment for settlement ${sessionId}`);
      } catch (assignErr) {
        console.error("Failed to auto-create assignment:", assignErr);
      }

      try {
        if (updated.bondName && updated.investorId) {
          const matchingBondSettlements = await db
            .select()
            .from(bondSettlements)
            .where(
              and(
                eq(bondSettlements.userId, userId),
                eq(bondSettlements.bondName, updated.bondName),
                eq(bondSettlements.investorId, updated.investorId),
                eq(bondSettlements.status, "pending")
              )
            );

          if (matchingBondSettlements.length === 1) {
            const matchingBondSettlement = matchingBondSettlements[0];
            await db
              .update(bondSettlements)
              .set({ status: "settled", updatedAt: now })
              .where(eq(bondSettlements.id, matchingBondSettlement.id));

            if (createdAssignmentId) {
              await db
                .update(assignments)
                .set({ bondSettlementId: matchingBondSettlement.id })
                .where(eq(assignments.id, createdAssignmentId));
            }
            console.log(`Linked bond settlement ${matchingBondSettlement.id} to assignment for settlement ${sessionId}`);
          } else if (matchingBondSettlements.length > 1) {
            console.warn(`Multiple pending bond settlements found for bond "${updated.bondName}" and investor ${updated.investorId}, skipping auto-link to avoid mismatch`);
          }
        }
      } catch (bondLinkErr) {
        console.error("Failed to link bond settlement:", bondLinkErr);
      }

      try {
        if (updated.journalEntryId) {
          console.log(`Journal entry already exists for settlement ${sessionId}, skipping`);
        } else {
        const [assetAccount] = await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.accountType, "asset"),
              eq(accounts.isActive, true)
            )
          )
          .limit(1);

        const [revenueAccount] = await db
          .select()
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.accountType, "revenue"),
              eq(accounts.isActive, true)
            )
          )
          .limit(1);

        if (assetAccount && revenueAccount) {
          const [journalEntry] = await db
            .insert(journalEntries)
            .values({
              userId,
              entryNumber: `SETTLE-${sessionId.slice(0, 8)}`,
              description: `Settlement confirmed for Trade ${updated.tradeId} - ${updated.bondName || "Bond"}`,
              date: now,
            })
            .returning();

          await db.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: assetAccount.id,
            debit: updated.amount,
            credit: "0",
            description: `Debit asset for settlement ${sessionId}`,
          });

          await db.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: revenueAccount.id,
            debit: "0",
            credit: updated.amount,
            description: `Credit revenue for settlement ${sessionId}`,
          });

          await recalculateAccountBalance(assetAccount.id, db);
          await recalculateAccountBalance(revenueAccount.id, db);

          await db
            .update(settlementSessions)
            .set({ journalEntryId: journalEntry.id })
            .where(eq(settlementSessions.sessionId, sessionId));

          console.log(`Auto-created journal entry for settlement ${sessionId}`);

          await logAudit(
            userId,
            "create",
            "journal_entry",
            journalEntry.id,
            `Auto-created journal entry ${journalEntry.entryNumber} for settlement ${sessionId}`,
            {
              settlementSessionId: sessionId,
              tradeId: updated.tradeId,
              amount: updated.amount,
              debitAccountId: assetAccount.id,
              creditAccountId: revenueAccount.id,
              correlationId: `settle-${sessionId}`,
            },
            req.ip
          );
        }
        }
      } catch (journalErr) {
        console.error("Failed to auto-create journal entry:", journalErr);
      }

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
          correlationId: `settle-${sessionId}`,
          escrowAccountId,
        },
        req.ip
      );

      const correlationId = `settle-${sessionId}`;
      const eventKey = `settle:${sessionId}`;
      const webhookPayload = JSON.stringify({
        eventId: `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        eventType: "settlement.completed",
        correlationId,
        data: {
          tradeId: Number(updated.tradeId),
          sessionId,
          paymentReference: updated.paymentReference,
          paidAt: now.toISOString(),
          investorEmail: updated.investorEmail,
          amount: updated.amount,
          receiptId,
          receiptUrl: `/api/admin/settlements/${sessionId}/receipt`,
        },
      });

      let webhookEnqueued = false;
      try {
        await db.insert(webhookOutbox).values({
          tenantId: userId,
          destination: "BONDAI",
          eventType: "settlement.completed",
          eventKey,
          payloadJson: webhookPayload,
          status: "PENDING",
          nextAttemptAt: new Date(),
        }).onConflictDoNothing();
        webhookEnqueued = true;
        console.log(`[OUTBOX] Enqueued settlement.completed for ${eventKey}`);
      } catch (err: any) {
        console.error("[OUTBOX] Failed to enqueue webhook:", err?.message);
      }

      res.json({
        success: true,
        session: updated,
        receiptId,
        receiptUrl: `/api/admin/settlements/${sessionId}/receipt`,
        webhookEnqueued,
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

  app.post("/api/admin/settlements/:sessionId/preview-token", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const sessionId = req.params.sessionId;

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const secret = process.env.JACE_SETTLEMENT_SECRET || process.env.SETTLEMENT_JWT_SECRET;
      if (!secret) return res.status(500).json({ message: "Settlement secret not configured" });

      const nowSec = Math.floor(Date.now() / 1000);
      const token = jwt.sign({
        sid: session.sessionId,
        tradeId: session.tradeId,
        bondId: session.bondId,
        amount: Number(session.amount),
        bondName: session.bondName,
        investorEmail: session.investorEmail,
        purpose: "preview",
        jti: crypto.randomUUID(),
        iat: nowSec,
        exp: nowSec + 900,
      }, secret, { algorithm: "HS256" });

      res.json({
        token,
        url: `/settlement?session=${encodeURIComponent(token)}`,
      });
    } catch (error) {
      console.error("Error generating preview token:", error);
      res.status(500).json({ message: "Failed to generate preview token" });
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

  app.post("/api/admin/settlements/manual", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { tradeId, investorEmail, investorName, amount, bondName, bondId, paymentReference, notes } = req.body;

      if (!tradeId || !amount) {
        return res.status(400).json({ message: "tradeId and amount are required" });
      }

      const parsedAmount = parseFloat(String(amount));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "amount must be a positive number" });
      }

      const parsedTradeId = parseInt(String(tradeId), 10);
      if (isNaN(parsedTradeId) || parsedTradeId <= 0) {
        return res.status(400).json({ message: "tradeId must be a positive integer" });
      }

      if (investorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(investorEmail)) {
        return res.status(400).json({ message: "investorEmail must be a valid email address" });
      }

      const sessionId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [session] = await db
        .insert(settlementSessions)
        .values({
          sessionId,
          tradeId: Number(tradeId),
          investorEmail: investorEmail || null,
          investorName: investorName || null,
          amount: String(amount),
          bondName: bondName || null,
          bondId: bondId ? Number(bondId) : null,
          paymentReference: paymentReference || null,
          status: "submitted",
          complianceStatus: "complete",
          complianceCompletedAt: now,
          createdAt: now,
          updatedAt: now,
          expiresAt,
        })
        .returning();

      await logAudit(userId, "create", "settlement_session", sessionId, `Manual settlement draft for Trade ${tradeId}`, { tradeId, amount, investorEmail }, req.ip);

      res.json({ success: true, session });
    } catch (error) {
      console.error("Error creating manual settlement:", error);
      res.status(500).json({ message: "Failed to create manual settlement" });
    }
  });

  app.get("/api/admin/webhooks/:sessionId", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const sessionId = req.params.sessionId;

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Session not found" });

      const payload = {
        eventId: `evt_preview_${Date.now()}`,
        eventType: "settlement.completed",
        correlationId: `trade-${session.tradeId}`,
        data: {
          tradeId: Number(session.tradeId),
          sessionId: session.sessionId,
          investorEmail: session.investorEmail,
          amount: session.amount,
          bondName: session.bondName,
          paymentReference: session.paymentReference,
          paidAt: session.settledAt?.toISOString() || null,
        },
      };

      const outboxRows = await db
        .select()
        .from(webhookOutbox)
        .where(eq(webhookOutbox.eventKey, `settle:${sessionId}`))
        .limit(5);

      res.json({ payload, outboxEntries: outboxRows });
    } catch (error) {
      console.error("Error previewing webhook:", error);
      res.status(500).json({ message: "Failed to preview webhook" });
    }
  });

  app.post("/api/admin/webhooks/:sessionId/resend", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sessionId = req.params.sessionId;

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Session not found" });

      if (session.status !== "settled") {
        return res.status(400).json({ message: "Can only resend webhooks for settled sessions" });
      }

      const eventKey = `settle:${sessionId}:resend:${Date.now()}`;
      const payload = JSON.stringify({
        eventId: `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        eventType: "settlement.completed",
        correlationId: `trade-${session.tradeId}`,
        data: {
          tradeId: Number(session.tradeId),
          sessionId: session.sessionId,
          investorEmail: session.investorEmail,
          amount: session.amount,
          bondName: session.bondName,
          paymentReference: session.paymentReference,
          paidAt: session.settledAt?.toISOString() || null,
          resend: true,
        },
      });

      await db.insert(webhookOutbox).values({
        tenantId: userId,
        destination: "BONDAI",
        eventType: "settlement.completed",
        eventKey,
        payloadJson: payload,
        status: "PENDING",
        nextAttemptAt: new Date(),
      });

      await logAudit(userId, "create", "webhook_resend", sessionId, `Resent webhook for Trade ${session.tradeId}`, { eventKey }, req.ip);

      res.json({ success: true, eventKey });
    } catch (error) {
      console.error("Error resending webhook:", error);
      res.status(500).json({ message: "Failed to resend webhook" });
    }
  });

  app.get("/api/admin/webhooks/outbox", isAuthenticated, requireInternalRole, async (req, res) => {
    try {
      const userId = getUserId(req);
      const rows = await db
        .select()
        .from(webhookOutbox)
        .where(eq(webhookOutbox.tenantId, userId))
        .orderBy(desc(webhookOutbox.createdAt))
        .limit(100);

      res.json(rows);
    } catch (error) {
      console.error("Error fetching outbox:", error);
      res.status(500).json({ message: "Failed to fetch outbox" });
    }
  });

  app.get("/api/investor-settlements", isAuthenticated, async (req: any, res) => {
    try {
      const investorId = typeof req.query.investorId === "string" ? req.query.investorId : null;
      if (!investorId) return res.status(400).json({ message: "investorId is required" });

      const userId = getUserId(req);
      if (userId) {
        const [inv] = await db
          .select()
          .from(investors)
          .where(eq(investors.id, investorId))
          .limit(1);
        if (!inv) {
          return res.status(404).json({ message: "Investor not found" });
        }
        if (inv.userId && inv.userId !== userId) {
          const userRole = await storage.getUserRole(userId);
          if (!userRole?.role || !["admin", "accounting", "ops", "investor_relations"].includes(userRole.role)) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const rows = await db
        .select({
          sessionId: settlementSessions.sessionId,
          tradeId: settlementSessions.tradeId,
          bondName: settlementSessions.bondName,
          amount: settlementSessions.amount,
          status: settlementSessions.status,
          settledAt: settlementSessions.settledAt,
          createdAt: settlementSessions.createdAt,
          receiptDocumentId: settlementSessions.receiptDocumentId,
          journalEntryId: settlementSessions.journalEntryId,
          unitCount: settlementSessions.unitCount,
          assignmentType: settlementSessions.assignmentType,
        })
        .from(settlementSessions)
        .where(eq(settlementSessions.investorId, investorId))
        .orderBy(desc(settlementSessions.createdAt))
        .limit(50);

      res.json(rows);
    } catch (error) {
      console.error("Error fetching investor settlements:", error);
      res.status(500).json({ message: "Failed to fetch investor settlements" });
    }
  });
}
