import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { and, desc, eq, sql } from "drizzle-orm";
import { investors, settlementSessions, settlementCompliance, journalEntries, journalEntryLines, accounts, documents } from "@shared/schema";
import { logAudit } from "./storage";
import { storage } from "./storage";
import { renderSettlementReceiptPdf } from "./lib/pdf/renderSettlementReceiptPdf";
import { sendBondAISettlementWebhook } from "./services/bondaiSettlementWebhook";

export interface SettlementJwtPayload {
  sid: string;
  tradeId: number;
  bondId?: number;
  investorId?: number;
  amount: number;
  bondName?: string;
  investorEmail?: string;
  units?: number;
  unitCount?: number;
  unitPrice?: number;
  issuerName?: string;
  assignmentType?: string;
  cusip?: string;
  maturityDate?: string;
  couponRate?: number;
  ipAddress?: string;
  userAgent?: string;
  exp: number;
  iat?: number;
  jti?: string;
  purpose?: string;
}

function settlementSecretOrThrow(): string {
  const v = process.env.JACE_SETTLEMENT_SECRET || process.env.SETTLEMENT_JWT_SECRET || process.env.BONDAI_SETTLEMENT_SECRET;
  if (!v) throw new Error("JACE_SETTLEMENT_SECRET (or BONDAI_SETTLEMENT_SECRET) is required");
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
  const fa = process.env.BONDAI_ALLOWED_FRAME_ANCESTORS || "'self' https://*.replit.app https://*.judgmentbonds.com https://judgmentbonds.com";
  res.setHeader("Content-Security-Policy", `frame-ancestors ${fa};`);
}

function verifySettlementJwt(token: string, secret: string, expectedPurpose?: string): SettlementJwtPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as SettlementJwtPayload;
    if (!decoded.sid || typeof decoded.tradeId !== "number" || typeof decoded.amount !== "number") {
      throw new Error("Invalid token claims");
    }
    if (expectedPurpose) {
      if (!decoded.purpose || decoded.purpose !== expectedPurpose) {
        throw new Error(`Token purpose mismatch: expected ${expectedPurpose}, got ${decoded.purpose || "none"}`);
      }
    }
    return decoded;
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") throw new Error("Token expired");
    if (err?.name === "JsonWebTokenError") throw new Error("Invalid token signature");
    throw new Error(err?.message || "Token verification failed");
  }
}

function signSettlementJwt(
  payload: Omit<SettlementJwtPayload, "exp" | "iat" | "jti">,
  secret: string,
  expiresInSeconds: number,
  purpose: string = "settlement"
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const full: SettlementJwtPayload = {
    ...(payload as any),
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
    jti: crypto.randomUUID(),
    purpose,
  };
  return jwt.sign(full, secret, { algorithm: "HS256" });
}

function requireBondAISecret(req: Request): { ok: boolean; reason?: string } {
  const expected = process.env.BONDAI_WEBHOOK_SECRET;
  const provided = (req.headers["x-bondai-webhook-secret"] as string) || (req.headers["x-api-key"] as string);

  if (!expected) {
    console.error("BONDAI_WEBHOOK_SECRET not configured - rejecting request for security");
    return { ok: false, reason: "BONDAI_WEBHOOK_SECRET must be configured" };
  }
  if (!provided) return { ok: false, reason: "Missing BondAI secret header" };
  return provided === expected ? { ok: true } : { ok: false, reason: "Invalid BondAI secret" };
}

export function registerSettlementRoutes(app: Express) {
  app.use((req, res, next) => {
    if (req.path === "/settlement" || req.path.startsWith("/settlement/") || req.path.startsWith("/api/settlement")) {
      setFrameAncestorsHeaders(res);
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

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

      const unitCount = req.body?.unitCount != null ? Number(req.body.unitCount) : (req.body?.units != null ? Number(req.body.units) : undefined);
      const unitPrice = req.body?.unitPrice != null ? Number(req.body.unitPrice) : undefined;
      const issuerName = typeof req.body?.issuerName === "string" ? req.body.issuerName : undefined;
      const assignmentType = typeof req.body?.assignmentType === "string" ? req.body.assignmentType : undefined;
      const cusip = typeof req.body?.cusip === "string" ? req.body.cusip : undefined;
      const maturityDate = typeof req.body?.maturityDate === "string" ? req.body.maturityDate : undefined;
      const couponRate = req.body?.couponRate != null ? Number(req.body.couponRate) : undefined;

      if (!Number.isFinite(tradeId) || tradeId <= 0) return res.status(400).json({ message: "Invalid tradeId" });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

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

      const ipAddress = typeof req.body?.ipAddress === "string" ? req.body.ipAddress : getClientIp(req);
      const userAgent = typeof req.body?.userAgent === "string" ? req.body.userAgent : getUserAgent(req);

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
          unitCount: unitCount != null ? unitCount.toString() : null,
          unitPrice: unitPrice != null ? unitPrice.toString() : null,
          issuerName: issuerName ?? null,
          assignmentType: assignmentType ?? null,
          cusip: cusip ?? null,
          maturityDate: maturityDate ? new Date(maturityDate) : null,
          couponRate: couponRate != null ? couponRate.toString() : null,
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
          unitCount,
          unitPrice,
          issuerName,
          assignmentType,
          cusip,
          maturityDate,
          couponRate,
        },
        secret,
        60 * 60,
        "settlement"
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

      const ipAddress = payload.ipAddress || getClientIp(req);
      const userAgent = payload.userAgent || getUserAgent(req);
      const expDate = new Date(payload.exp * 1000);

      if (existing) {
        const resolvedUnitCount = payload.unitCount ?? payload.units;
        const updateFields: Record<string, any> = {
            investorEmail: payload.investorEmail ?? existing.investorEmail,
            investorId: matchedInvestorId,
            investorName: matchedInvestorName,
            ipAddress,
            userAgent,
            bondName: payload.bondName ?? existing.bondName,
            expiresAt: expDate,
            updatedAt: new Date(),
            issuerName: payload.issuerName ?? existing.issuerName,
            assignmentType: payload.assignmentType ?? existing.assignmentType,
            cusip: payload.cusip ?? existing.cusip,
            maturityDate: payload.maturityDate ? new Date(payload.maturityDate) : existing.maturityDate,
            couponRate: payload.couponRate != null ? payload.couponRate.toString() : existing.couponRate,
        };
        if (existing.unitCount == null && resolvedUnitCount != null) {
          updateFields.unitCount = resolvedUnitCount.toString();
        }
        if (existing.unitPrice == null && payload.unitPrice != null) {
          updateFields.unitPrice = payload.unitPrice.toString();
        }
        const [updated] = await db
          .update(settlementSessions)
          .set(updateFields)
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
          complianceStatus: updated.complianceStatus || "not_started",
          complianceRequired: true,
          unitCount: updated.unitCount != null ? Number(updated.unitCount) : null,
          unitPrice: updated.unitPrice != null ? Number(updated.unitPrice) : null,
          issuerName: updated.issuerName ?? null,
          assignmentType: updated.assignmentType ?? null,
          cusip: updated.cusip ?? null,
          maturityDate: updated.maturityDate?.toISOString?.() ?? null,
          couponRate: updated.couponRate != null ? Number(updated.couponRate) : null,
        });
      }

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
          ipAddress: payload.ipAddress || ipAddress,
          userAgent: payload.userAgent || userAgent,
          amount: payload.amount.toString(),
          bondName: payload.bondName ?? null,
          status: "pending",
          expiresAt: expDate,
          unitCount: (payload.unitCount ?? payload.units) != null ? (payload.unitCount ?? payload.units)!.toString() : null,
          unitPrice: payload.unitPrice != null ? payload.unitPrice.toString() : null,
          issuerName: payload.issuerName ?? null,
          assignmentType: payload.assignmentType ?? null,
          cusip: payload.cusip ?? null,
          maturityDate: payload.maturityDate ? new Date(payload.maturityDate) : null,
          couponRate: payload.couponRate != null ? payload.couponRate.toString() : null,
        })
        .returning();

      const resolvedUnitCount = payload.unitCount ?? payload.units ?? null;
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
        complianceStatus: "not_started",
        complianceRequired: true,
        unitCount: resolvedUnitCount,
        unitPrice: payload.unitPrice ?? null,
        issuerName: payload.issuerName ?? null,
        assignmentType: payload.assignmentType ?? null,
        cusip: payload.cusip ?? null,
        maturityDate: payload.maturityDate ?? null,
        couponRate: payload.couponRate ?? null,
      });
    } catch (error: any) {
      console.error("Settlement session error:", error);
      res.status(400).json({ message: error?.message || "Invalid settlement session" });
    }
  });

  app.post("/api/settlement/complete", async (req: Request, res: Response) => {
    try {
      const token = req.body?.token as string;
      const paymentReference = (req.body?.paymentReference as string) || null;
      const acknowledged = req.body?.acknowledged;

      if (!token) return res.status(400).json({ message: "Missing token" });

      if (acknowledged !== true) {
        return res.status(400).json({ message: "You must acknowledge the purchase terms before confirming." });
      }

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Settlement session not found" });
      if (Math.abs(payload.amount - Number(session.amount)) > 0.01) {
        console.error(`SECURITY: Amount mismatch on settlement ${payload.sid} - token: ${payload.amount}, db: ${session.amount}`);
        return res.status(403).json({ message: "Settlement amount mismatch detected" });
      }
      const dbUnitCount = session.unitCount != null ? Number(session.unitCount) : null;
      const tokenUnitCount = payload.unitCount ?? payload.units ?? null;
      if (dbUnitCount != null && tokenUnitCount != null && Math.abs(dbUnitCount - tokenUnitCount) > 0.001) {
        console.error(`SECURITY: Unit count mismatch on settlement ${payload.sid} - token: ${tokenUnitCount}, db: ${dbUnitCount}`);
        return res.status(403).json({ message: "Settlement unit count mismatch detected" });
      }

      const dbUnitPrice = session.unitPrice != null ? Number(session.unitPrice) : null;
      const tokenUnitPrice = payload.unitPrice ?? null;
      if (dbUnitPrice != null && tokenUnitPrice != null && Math.abs(dbUnitPrice - tokenUnitPrice) > 0.01) {
        console.error(`SECURITY: Unit price mismatch on settlement ${payload.sid} - token: ${tokenUnitPrice}, db: ${dbUnitPrice}`);
        return res.status(403).json({ message: "Settlement unit price mismatch detected" });
      }

      if (session.status === "settled") return res.status(400).json({ message: "This settlement is already confirmed" });
      if (session.status === "cancelled") return res.status(400).json({ message: "This settlement has been cancelled" });

      if (session.complianceStatus !== "complete") {
        const [complianceRecord] = await db
          .select()
          .from(settlementCompliance)
          .where(eq(settlementCompliance.sessionId, payload.sid))
          .limit(1);

        if (!complianceRecord || complianceRecord.status !== "complete") {
          return res.status(409).json({
            message: "Compliance must be completed before submitting settlement",
            code: "COMPLIANCE_REQUIRED",
            complianceStatus: complianceRecord?.status || "not_started",
          });
        }
      }

      const now = new Date();
      const clientIp = getClientIp(req);

      const [updated] = await db
        .update(settlementSessions)
        .set({
          status: "submitted",
          paymentReference,
          ipAddress: clientIp,
          userAgent: getUserAgent(req),
          updatedAt: now,
          acknowledgedAt: now,
          acknowledgedIp: clientIp,
        })
        .where(eq(settlementSessions.sessionId, payload.sid))
        .returning();

      let receiptDocumentId: string | null = null;
      try {
        const receiptId = crypto.randomUUID();
        const pdfBuffer = await renderSettlementReceiptPdf({
          receiptId,
          sessionId: updated.sessionId,
          tradeId: updated.tradeId,
          bondName: updated.bondName,
          bondId: updated.bondId,
          investorEmail: updated.investorEmail,
          amount: Number(updated.amount),
          paymentReference: updated.paymentReference,
          confirmedAtISO: now.toISOString(),
          confirmedByUserId: "system",
          notes: `Investor-initiated settlement submission for Trade #${updated.tradeId}`,
        });

        const uploadsDir = path.resolve("./uploads");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const pdfFilename = `settlement_receipt_${updated.sessionId.substring(0, 8)}_${Date.now()}.pdf`;
        const pdfPath = path.join(uploadsDir, pdfFilename);
        fs.writeFileSync(pdfPath, pdfBuffer);

        const doc = await storage.createDocument("system", {
          filename: pdfFilename,
          originalName: `Settlement Receipt - Trade ${updated.tradeId}.pdf`,
          mimeType: "application/pdf",
          size: pdfBuffer.length,
          investorId: updated.investorId ?? undefined,
          category: "settlement_investor_receipt",
          description: `Settlement receipt for Trade #${updated.tradeId}, Session ${updated.sessionId}`,
        });

        receiptDocumentId = doc.id;

        await db
          .update(settlementSessions)
          .set({ receiptDocumentId })
          .where(eq(settlementSessions.sessionId, payload.sid));
      } catch (pdfErr: any) {
        console.error("Failed to generate settlement receipt PDF:", pdfErr);
      }

      let journalEntryId: string | null = null;
      try {
        const ownerUserId = process.env.ONBOARDING_DEFAULT_OWNER_USER_ID || "env-admin-001";

        const [debitAccount] = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.accountType, "asset"), eq(accounts.userId, ownerUserId)))
          .limit(1);

        const [creditAccount] = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.accountType, "revenue"), eq(accounts.userId, ownerUserId)))
          .limit(1);

        if (debitAccount && creditAccount) {
          const amountStr = Number(updated.amount).toFixed(2);
          const entryNumber = `SETTLE-${updated.sessionId.substring(0, 8)}`;
          const description = `Assignment Unit Purchase - Trade #${updated.tradeId} - $${amountStr}`;

          const [journalEntry] = await db
            .insert(journalEntries)
            .values({
              userId: ownerUserId,
              entryNumber,
              description,
              date: now,
            })
            .returning();

          await db.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: debitAccount.id,
            debit: amountStr,
            credit: "0",
            description: `Debit Cash/Escrow - Trade #${updated.tradeId}`,
          });

          await db.insert(journalEntryLines).values({
            journalEntryId: journalEntry.id,
            accountId: creditAccount.id,
            debit: "0",
            credit: amountStr,
            description: `Credit Bond Revenue - Trade #${updated.tradeId}`,
          });

          journalEntryId = journalEntry.id;

          await db
            .update(settlementSessions)
            .set({ journalEntryId })
            .where(eq(settlementSessions.sessionId, payload.sid));
        }
      } catch (journalErr: any) {
        console.error("Failed to create journal entry for settlement:", journalErr);
      }

      try {
        await logAudit(
          "system",
          "update",
          "settlement_session",
          payload.sid,
          `Settlement submitted for Trade ${updated.tradeId}`,
          { tradeId: updated.tradeId, amount: updated.amount, paymentReference },
          clientIp
        );
      } catch {
      }

      sendBondAISettlementWebhook("settlement.completed", updated.tradeId, updated.sessionId, {
        investorEmail: updated.investorEmail,
        amount: updated.amount,
        paymentReference: updated.paymentReference || paymentReference,
        paidAt: new Date().toISOString(),
        ipAddress: updated.ipAddress,
        userAgent: updated.userAgent,
      }).catch(err => console.error("[JACE WEBHOOK] settlement.completed fire-and-forget error:", err));

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
      }

      sendBondAISettlementWebhook("settlement.cancelled", payload.tradeId, payload.sid, {
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        reason,
      }).catch(
        err => console.error("[JACE WEBHOOK] settlement.cancelled fire-and-forget error:", err)
      );

      res.json({ success: true, message: "Settlement cancelled" });
    } catch (error: any) {
      console.error("Settlement cancel error:", error);
      res.status(400).json({ message: error?.message || "Failed to cancel settlement" });
    }
  });

  app.get("/api/settlement/receipt", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      if (!session.receiptDocumentId) {
        return res.status(404).json({ message: "Receipt not yet available" });
      }

      const [doc] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, session.receiptDocumentId))
        .limit(1);

      if (!doc) return res.status(404).json({ message: "Receipt document record not found" });

      const receiptPath = path.join("./uploads", doc.filename);

      if (!fs.existsSync(receiptPath)) {
        return res.status(404).json({ message: "Receipt file not found on disk" });
      }

      try {
        await logAudit(
          "system",
          "create",
          "settlement_receipt",
          session.sessionId,
          `Receipt downloaded for Trade ${session.tradeId}`,
          { tradeId: session.tradeId, documentId: session.receiptDocumentId },
          getClientIp(req)
        );
      } catch {}

      setFrameAncestorsHeaders(res);
      res.setHeader("Content-Type", doc.mimeType || "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${doc.originalName || doc.filename}"`);
      fs.createReadStream(receiptPath).pipe(res);
    } catch (error: any) {
      console.error("Settlement receipt download error:", error);
      res.status(400).json({ message: error?.message || "Failed to download receipt" });
    }
  });

}
