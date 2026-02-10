import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import multer from "multer";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { documents, investors, settlementCompliance, settlementSessions } from "@shared/schema";
import { storage, logAudit } from "./storage";
import { renderSettlementCompliancePdf } from "./lib/pdf/renderSettlementCompliancePdf";

const UPLOAD_DIR = "./uploads";

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function getSettlementJwtSecret(): string {
  const secret = process.env.JACE_SETTLEMENT_SECRET || process.env.SETTLEMENT_JWT_SECRET || process.env.BONDAI_SETTLEMENT_SECRET;
  if (!secret) {
    throw new Error("JACE_SETTLEMENT_SECRET or BONDAI_SETTLEMENT_SECRET must be configured");
  }
  return secret;
}

function maskLast4(v?: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  return s.length >= 4 ? s.slice(-4) : s;
}

function normalizeTaxId(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "").trim();
}

function encryptSensitive(value: string, key: Buffer): { ciphertextB64: string; ivHex: string; tagHex: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: ciphertext.toString("base64"),
    ivHex: iv.toString("hex"),
    tagHex: tag.toString("hex"),
  };
}

function getEncryptionKey(): Buffer {
  const base64Key = process.env.JACE_ENCRYPTION_KEY_BASE64;
  if (!base64Key) {
    throw new Error("JACE_ENCRYPTION_KEY_BASE64 must be configured for encryption operations");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("JACE_ENCRYPTION_KEY_BASE64 must decode to 32 bytes (AES-256 key).");
  }
  return key;
}

async function resolveOwnerUserIdForSession(session: typeof settlementSessions.$inferSelect): Promise<string | null> {
  try {
    if (session.investorId) {
      const [inv] = await db.select().from(investors).where(eq(investors.id, session.investorId)).limit(1);
      if (inv?.userId) return inv.userId;
    }

    if (session.investorEmail) {
      const [inv] = await db
        .select()
        .from(investors)
        .where(sql`lower(${investors.email}) = lower(${session.investorEmail})`)
        .orderBy(desc(investors.createdAt))
        .limit(1);
      if (inv?.userId) return inv.userId;
    }

    const { users } = await import("@shared/models/auth");
    const [admin] = await db.select().from(users).where(eq(users.isAdmin, "true")).limit(1);
    if (admin?.id) return admin.id;
    const [anyUser] = await db.select().from(users).limit(1);
    return anyUser?.id ?? null;
  } catch (e) {
    console.error("resolveOwnerUserIdForSession failed", e);
    return null;
  }
}

function verifySessionToken(token: string): { sessionId: string } {
  const secret = getSettlementJwtSecret();
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
  if (!decoded?.sessionId) throw new Error("Invalid settlement token");
  return { sessionId: decoded.sessionId };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `settlement-compliance-${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

type ComplianceSnapshot = {
  sessionId: string;
  status: string;
  entityType: string;
  entityLegalName: string | null;
  taxIdType: string | null;
  taxIdLast4: string | null;
  accreditedInvestor: boolean;
  privatePartyAck: boolean;
  holdHarmlessAck: boolean;
  setExchangeAck: boolean;
  authorizationSigned: boolean;
  authorizationSignedAt: string | null;
  signatureName: string | null;
  idPrimaryDocumentId: string | null;
  idSecondaryDocumentId: string | null;
  creditReportDocumentId: string | null;
  creditProvider: string | null;
  creditReference: string | null;
  creditStatus: string;
  completedAt: string | null;
};

function toSnapshot(row: typeof settlementCompliance.$inferSelect): ComplianceSnapshot {
  return {
    sessionId: row.sessionId,
    status: row.status,
    entityType: row.entityType,
    entityLegalName: row.entityLegalName ?? null,
    taxIdType: row.taxIdType ?? null,
    taxIdLast4: row.taxIdLast4 ?? null,
    accreditedInvestor: !!row.accreditedInvestor,
    privatePartyAck: !!row.privatePartyAck,
    holdHarmlessAck: !!row.holdHarmlessAck,
    setExchangeAck: !!row.setExchangeAck,
    authorizationSigned: !!row.authorizationSigned,
    authorizationSignedAt: row.authorizationSignedAt ? new Date(row.authorizationSignedAt).toISOString() : null,
    signatureName: row.signatureName ?? null,
    idPrimaryDocumentId: row.idPrimaryDocumentId ?? null,
    idSecondaryDocumentId: row.idSecondaryDocumentId ?? null,
    creditReportDocumentId: row.creditReportDocumentId ?? null,
    creditProvider: row.creditProvider ?? null,
    creditReference: row.creditReference ?? null,
    creditStatus: row.creditStatus,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
  };
}

async function getOrCreateCompliance(session: typeof settlementSessions.$inferSelect) {
  const [existing] = await db.select().from(settlementCompliance).where(eq(settlementCompliance.sessionId, session.sessionId)).limit(1);
  if (existing) return existing;

  const ownerUserId = (await resolveOwnerUserIdForSession(session)) || "";
  if (!ownerUserId) throw new Error("Unable to resolve owner user for session");

  const [created] = await db
    .insert(settlementCompliance)
    .values({
      sessionId: session.sessionId,
      ownerUserId,
      investorId: session.investorId ?? null,
      entityType: "individual",
      status: "in_progress",
    })
    .returning();
  return created;
}

function validateCompleteness(row: typeof settlementCompliance.$inferSelect): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!row.entityLegalName || row.entityLegalName.trim().length < 2) missing.push("entityLegalName");
  if (!row.taxIdType) missing.push("taxIdType");
  if (!row.taxIdLast4) missing.push("taxIdLast4");
  if (!row.taxIdCiphertext || !row.taxIdIv || !row.taxIdTag) missing.push("taxIdEncrypted");
  if (!row.idPrimaryDocumentId) missing.push("idPrimaryDocument");
  if (!row.idSecondaryDocumentId) missing.push("idSecondaryDocument");
  if (!row.authorizationSigned) missing.push("authorizationSignature");
  if (!row.creditReportDocumentId && row.creditStatus !== "received") missing.push("triMergeCreditReport");
  if (!row.accreditedInvestor) missing.push("accreditedInvestorAck");
  if (!row.privatePartyAck) missing.push("privatePartyAck");
  if (!row.holdHarmlessAck) missing.push("holdHarmlessAck");
  if (!row.setExchangeAck) missing.push("setExchangeAck");
  return { ok: missing.length === 0, missing };
}

export function registerSettlementComplianceRoutes(app: Express) {
  app.get("/api/settlement/compliance", async (req: Request, res: Response) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { sessionId } = verifySessionToken(token);

      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const row = await getOrCreateCompliance(session);
      return res.json(toSnapshot(row));
    } catch (e: any) {
      console.error("GET /api/settlement/compliance error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });

  app.post("/api/settlement/compliance/save", async (req: Request, res: Response) => {
    try {
      const token = typeof (req.body as any)?.token === "string" ? (req.body as any).token : "";
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { sessionId } = verifySessionToken(token);

      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const existing = await getOrCreateCompliance(session);

      const entityType = typeof (req.body as any).entityType === "string" ? (req.body as any).entityType : undefined;
      const entityLegalName = typeof (req.body as any).entityLegalName === "string" ? (req.body as any).entityLegalName : undefined;
      const taxIdType = typeof (req.body as any).taxIdType === "string" ? (req.body as any).taxIdType : undefined;
      const taxIdRaw = typeof (req.body as any).taxId === "string" ? (req.body as any).taxId : undefined;

      const accreditedInvestor = typeof (req.body as any).accreditedInvestor === "boolean" ? (req.body as any).accreditedInvestor : undefined;
      const privatePartyAck = typeof (req.body as any).privatePartyAck === "boolean" ? (req.body as any).privatePartyAck : undefined;
      const holdHarmlessAck = typeof (req.body as any).holdHarmlessAck === "boolean" ? (req.body as any).holdHarmlessAck : undefined;
      const setExchangeAck = typeof (req.body as any).setExchangeAck === "boolean" ? (req.body as any).setExchangeAck : undefined;

      const patch: Partial<typeof settlementCompliance.$inferInsert> = { updatedAt: new Date() };
      if (entityType && ["individual", "trust", "llc"].includes(entityType)) patch.entityType = entityType as any;
      if (typeof entityLegalName === "string") patch.entityLegalName = entityLegalName.trim();

      if (taxIdType && ["SSN", "EIN"].includes(taxIdType)) patch.taxIdType = taxIdType as any;
      if (taxIdRaw && taxIdType) {
        const normalized = normalizeTaxId(taxIdRaw);
        if (!normalized || normalized.length < 4) {
          return res.status(400).json({ message: "Invalid tax id" });
        }
        const encKey = getEncryptionKey();
        const enc = encryptSensitive(normalized, encKey);
        patch.taxIdLast4 = maskLast4(normalized);
        patch.taxIdCiphertext = enc.ciphertextB64;
        patch.taxIdIv = enc.ivHex;
        patch.taxIdTag = enc.tagHex;
      }

      if (typeof accreditedInvestor === "boolean") patch.accreditedInvestor = accreditedInvestor;
      if (typeof privatePartyAck === "boolean") patch.privatePartyAck = privatePartyAck;
      if (typeof holdHarmlessAck === "boolean") patch.holdHarmlessAck = holdHarmlessAck;
      if (typeof setExchangeAck === "boolean") patch.setExchangeAck = setExchangeAck;

      const [updated] = await db
        .update(settlementCompliance)
        .set(patch)
        .where(eq(settlementCompliance.id, existing.id))
        .returning();

      return res.json(toSnapshot(updated));
    } catch (e: any) {
      console.error("POST /api/settlement/compliance/save error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });

  app.post("/api/settlement/compliance/upload", upload.single("file"), async (req: any, res: Response) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      const kind = typeof req.body?.kind === "string" ? req.body.kind : "";
      const file = req.file;
      if (!token) return res.status(400).json({ message: "Missing token" });
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      if (!kind) return res.status(400).json({ message: "Missing kind" });

      const { sessionId } = verifySessionToken(token);
      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const row = await getOrCreateCompliance(session);
      const ownerUserId = row.ownerUserId;

      const doc = await storage.createDocument(ownerUserId, {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        investorId: session.investorId ?? null,
        category: kind,
        description: `Settlement compliance upload (${kind}) for Session ${sessionId}`,
      });

      const patch: Partial<typeof settlementCompliance.$inferInsert> = { updatedAt: new Date() };
      if (kind === "id_primary") patch.idPrimaryDocumentId = doc.id;
      if (kind === "id_secondary") patch.idSecondaryDocumentId = doc.id;
      if (kind === "credit_report") {
        patch.creditReportDocumentId = doc.id;
        patch.creditStatus = "received";
      }

      const [updated] = await db
        .update(settlementCompliance)
        .set(patch)
        .where(eq(settlementCompliance.id, row.id))
        .returning();

      await logAudit(ownerUserId, "create", "settlement_compliance_upload", doc.id, `Uploaded ${kind} for settlement ${sessionId}`);

      return res.status(201).json({ documentId: doc.id, compliance: toSnapshot(updated) });
    } catch (e: any) {
      console.error("POST /api/settlement/compliance/upload error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });

  app.post("/api/settlement/compliance/sign", async (req: Request, res: Response) => {
    try {
      const token = typeof (req.body as any)?.token === "string" ? (req.body as any).token : "";
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { sessionId } = verifySessionToken(token);

      const signatureName = typeof (req.body as any).signatureName === "string" ? (req.body as any).signatureName : "";
      const signatureMethod = typeof (req.body as any).signatureMethod === "string" ? (req.body as any).signatureMethod : "TYPED";
      const signatureValue = typeof (req.body as any).signatureValue === "string" ? (req.body as any).signatureValue : "";

      if (!signatureName.trim() || !signatureValue.trim()) {
        return res.status(400).json({ message: "Signature name and value required" });
      }

      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const row = await getOrCreateCompliance(session);
      const now = new Date();

      const [updated] = await db
        .update(settlementCompliance)
        .set({
          authorizationSigned: true,
          authorizationSignedAt: now,
          signatureName: signatureName.trim(),
          signatureMethod: signatureMethod === "DRAWN" ? "DRAWN" : "TYPED",
          signatureValue: signatureValue,
          updatedAt: now,
          creditStatus: row.creditStatus === "not_requested" ? "requested" : row.creditStatus,
        })
        .where(eq(settlementCompliance.id, row.id))
        .returning();

      return res.json(toSnapshot(updated));
    } catch (e: any) {
      console.error("POST /api/settlement/compliance/sign error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });

  app.post("/api/settlement/compliance/pull-credit", async (req: Request, res: Response) => {
    try {
      const token = typeof (req.body as any)?.token === "string" ? (req.body as any).token : "";
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { sessionId } = verifySessionToken(token);

      const provider = typeof (req.body as any).provider === "string" ? (req.body as any).provider : "demo";
      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const row = await getOrCreateCompliance(session);
      const now = new Date();

      const reference = `TRI-${now.getTime()}-${sessionId.slice(0, 6)}`;
      const [updated] = await db
        .update(settlementCompliance)
        .set({
          creditProvider: provider,
          creditReference: reference,
          creditStatus: "received",
          updatedAt: now,
        })
        .where(eq(settlementCompliance.id, row.id))
        .returning();

      return res.json({ ok: true, reference, compliance: toSnapshot(updated) });
    } catch (e: any) {
      console.error("POST /api/settlement/compliance/pull-credit error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });

  app.post("/api/settlement/compliance/complete", async (req: Request, res: Response) => {
    try {
      const token = typeof (req.body as any)?.token === "string" ? (req.body as any).token : "";
      if (!token) return res.status(400).json({ message: "Missing token" });
      const { sessionId } = verifySessionToken(token);

      const [session] = await db.select().from(settlementSessions).where(eq(settlementSessions.sessionId, sessionId)).limit(1);
      if (!session) return res.status(404).json({ message: "Settlement session not found" });

      const row = await getOrCreateCompliance(session);
      const check = validateCompleteness(row);
      if (!check.ok) {
        return res.status(422).json({ message: "Compliance incomplete", missing: check.missing });
      }

      const now = new Date();
      const complianceId = `COMP-${now.getTime()}-${sessionId.slice(0, 8)}`;

      const pdf = await renderSettlementCompliancePdf({
        complianceId,
        sessionId,
        tradeId: session.tradeId,
        bondName: session.bondName,
        amount: Number(session.amount),
        investorEmail: session.investorEmail,
        entityType: row.entityType,
        entityLegalName: row.entityLegalName || "",
        taxIdType: row.taxIdType || "",
        taxIdLast4: row.taxIdLast4 || "",
        accreditedInvestor: row.accreditedInvestor,
        privatePartyAck: row.privatePartyAck,
        holdHarmlessAck: row.holdHarmlessAck,
        setExchangeAck: row.setExchangeAck,
        authorizationSignedAtISO: row.authorizationSignedAt ? new Date(row.authorizationSignedAt).toISOString() : now.toISOString(),
        signatureName: row.signatureName || "",
        signatureMethod: row.signatureMethod || "TYPED",
        creditProvider: row.creditProvider || "",
        creditReference: row.creditReference || "",
        createdAtISO: now.toISOString(),
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req.ip as any) || "",
        userAgent: (req.headers["user-agent"] as string) || "",
      });

      ensureUploadDir();
      const filename = `settlement-compliance-${sessionId}.pdf`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), pdf);

      const doc = await storage.createDocument(row.ownerUserId, {
        filename,
        originalName: `Settlement Compliance Gate - Trade ${session.tradeId}.pdf`,
        mimeType: "application/pdf",
        size: pdf.length,
        investorId: session.investorId ?? null,
        category: "settlement_compliance",
        description: `Settlement compliance gate for Trade ${session.tradeId} (Session ${sessionId})`,
      });

      const [updatedCompliance] = await db
        .update(settlementCompliance)
        .set({ status: "complete", completedAt: now, updatedAt: now })
        .where(eq(settlementCompliance.id, row.id))
        .returning();

      await db
        .update(settlementSessions)
        .set({ complianceStatus: "complete", complianceCompletedAt: now, updatedAt: now })
        .where(eq(settlementSessions.sessionId, sessionId));

      await logAudit(
        row.ownerUserId,
        "update",
        "settlement_compliance",
        row.id,
        `Completed settlement compliance gate for Trade ${session.tradeId}`,
        { sessionId, tradeId: session.tradeId, complianceId, documentId: doc.id },
        req.ip
      );

      return res.json({ ok: true, complianceId, documentId: doc.id, compliance: toSnapshot(updatedCompliance) });
    } catch (e: any) {
      console.error("POST /api/settlement/compliance/complete error", e);
      return res.status(401).json({ message: e?.message || "Invalid token" });
    }
  });
}
