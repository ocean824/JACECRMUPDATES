import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { settlementCompliance, settlementSessions } from "@shared/schema";
import { renderSettlementCompliancePacketPdf } from "./lib/pdf/renderSettlementCompliancePacketPdf";

interface SettlementJwtPayload {
  sid: string;
  tradeId: number;
  bondId?: number;
  investorId?: number;
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

function encryptTaxId(plaintext: string): { ciphertext: string; iv: string; tag: string } {
  const keyBase64 = process.env.JACE_ENCRYPTION_KEY_BASE64 || process.env.JACE_TAXID_ENCRYPTION_KEY_BASE64;
  if (!keyBase64) throw new Error("Encryption key not configured — set JACE_ENCRYPTION_KEY_BASE64");
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error(`AES-256 key must be 32 bytes, got ${key.length}`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: (cipher as any).getAuthTag().toString("base64"),
  };
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

const UPLOAD_DIR = "./uploads";

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const ext = path.extname(file.originalname);
    cb(null, `compliance-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

export function registerSettlementComplianceRoutes(app: Express) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/settlement/compliance")) {
      setFrameAncestorsHeaders(res);
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.get("/api/settlement/compliance", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [complianceRecord] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      if (!complianceRecord) {
        return res.json({
          sessionId: payload.sid,
          complianceStatus: session?.complianceStatus || "not_started",
          entityType: null,
          legalName: null,
          taxIdType: null,
          taxIdLast4: null,
          idPrimaryFileKey: null,
          idPrimaryOriginalName: null,
          idSecondaryFileKey: null,
          idSecondaryOriginalName: null,
          creditReportFileKey: null,
          creditReportOriginalName: null,
          creditReportStatus: "not_requested",
          creditReportRequestedAt: null,
          creditReportCompletedAt: null,
          creditAuthorizationSigned: false,
          creditAuthorizationSignedAt: null,
          accreditedInvestorAttested: false,
          accreditedInvestorSignedAt: null,
          holdHarmlessSigned: false,
          holdHarmlessSignedAt: null,
          privatePartySelfDirected: false,
          privatePartySelfDirectedSignedAt: null,
          signatureName: null,
          signatureIp: null,
          signatureUserAgent: null,
          compliancePacketFileKey: null,
          completedAt: null,
        });
      }

      return res.json({
        ...complianceRecord,
        complianceStatus: complianceRecord.complianceStatus || session?.complianceStatus || "not_started",
      });
    } catch (err: any) {
      console.error("GET /api/settlement/compliance error:", err);
      return res.status(401).json({ message: err?.message || "Unauthorized" });
    }
  });

  app.post("/api/settlement/compliance/save", async (req: Request, res: Response) => {
    try {
      const { token, entityType, legalName, taxIdType, taxIdLast4, taxIdFull } = req.body || {};
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      let taxIdCiphertext: string | null = null;
      let taxIdIv: string | null = null;
      let taxIdTag: string | null = null;

      if (taxIdFull && typeof taxIdFull === "string") {
        const encrypted = encryptTaxId(taxIdFull);
        taxIdCiphertext = encrypted.ciphertext;
        taxIdIv = encrypted.iv;
        taxIdTag = encrypted.tag;
      }

      const now = new Date();
      const values: Record<string, any> = {
        sessionId: payload.sid,
        complianceStatus: "in_progress",
        updatedAt: now,
      };

      if (entityType !== undefined) values.entityType = String(entityType).toLowerCase();
      if (legalName !== undefined) values.legalName = legalName;
      if (taxIdType !== undefined) values.taxIdType = String(taxIdType).toUpperCase();
      if (taxIdLast4 !== undefined) values.taxIdLast4 = String(taxIdLast4).slice(-4);
      if (taxIdCiphertext) {
        values.taxIdCiphertext = taxIdCiphertext;
        values.taxIdIv = taxIdIv;
        values.taxIdTag = taxIdTag;
      }

      const [existing] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      let record;
      if (existing) {
        const { sessionId: _sid, ...updateValues } = values;
        [record] = await db
          .update(settlementCompliance)
          .set(updateValues)
          .where(eq(settlementCompliance.sessionId, payload.sid))
          .returning();
      } else {
        values.createdAt = now;
        [record] = await db
          .insert(settlementCompliance)
          .values(values as any)
          .returning();
      }

      await db
        .update(settlementSessions)
        .set({ complianceStatus: "in_progress", updatedAt: now })
        .where(eq(settlementSessions.sessionId, payload.sid));

      return res.json(record);
    } catch (err: any) {
      console.error("POST /api/settlement/compliance/save error:", err);
      return res.status(err?.message?.includes("Token") ? 401 : 500).json({ message: err?.message || "Failed to save compliance data" });
    }
  });

  app.post("/api/settlement/compliance/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const token = (req.query.token as string) || req.body?.token;
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const docType = req.body?.docType as string;
      if (!docType || !["id_primary", "id_secondary", "credit_report"].includes(docType)) {
        return res.status(400).json({ message: "Invalid docType. Must be id_primary, id_secondary, or credit_report" });
      }

      const fileKey = file.filename;
      const originalName = file.originalname;
      const now = new Date();

      const updateFields: Record<string, any> = { updatedAt: now };

      if (docType === "id_primary") {
        updateFields.idPrimaryFileKey = fileKey;
        updateFields.idPrimaryOriginalName = originalName;
      } else if (docType === "id_secondary") {
        updateFields.idSecondaryFileKey = fileKey;
        updateFields.idSecondaryOriginalName = originalName;
      } else if (docType === "credit_report") {
        updateFields.creditReportFileKey = fileKey;
        updateFields.creditReportOriginalName = originalName;
      }

      const [existing] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      if (existing) {
        await db
          .update(settlementCompliance)
          .set(updateFields)
          .where(eq(settlementCompliance.sessionId, payload.sid));
      } else {
        await db
          .insert(settlementCompliance)
          .values({
            sessionId: payload.sid,
            complianceStatus: "in_progress",
            createdAt: now,
            ...updateFields,
          } as any);
      }

      return res.json({
        success: true,
        docType,
        fileKey,
        originalName,
      });
    } catch (err: any) {
      console.error("POST /api/settlement/compliance/upload error:", err);
      return res.status(err?.message?.includes("Token") ? 401 : 500).json({ message: err?.message || "Failed to upload file" });
    }
  });

  app.post("/api/settlement/compliance/sign", async (req: Request, res: Response) => {
    try {
      const {
        token,
        accreditedInvestorAttested,
        holdHarmlessSigned,
        privatePartySelfDirected,
        creditAuthorizationSigned,
        signatureName,
      } = req.body || {};

      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const now = new Date();
      const ip = getClientIp(req);
      const ua = getUserAgent(req);

      const updateFields: Record<string, any> = {
        updatedAt: now,
        signatureIp: ip,
        signatureUserAgent: ua,
      };

      if (signatureName !== undefined) updateFields.signatureName = signatureName;

      if (accreditedInvestorAttested === true) {
        updateFields.accreditedInvestorAttested = true;
        updateFields.accreditedInvestorSignedAt = now;
      }
      if (holdHarmlessSigned === true) {
        updateFields.holdHarmlessSigned = true;
        updateFields.holdHarmlessSignedAt = now;
      }
      if (privatePartySelfDirected === true) {
        updateFields.privatePartySelfDirected = true;
        updateFields.privatePartySelfDirectedSignedAt = now;
      }
      if (creditAuthorizationSigned === true) {
        updateFields.creditAuthorizationSigned = true;
        updateFields.creditAuthorizationSignedAt = now;
      }

      const [existing] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      let record;
      if (existing) {
        [record] = await db
          .update(settlementCompliance)
          .set(updateFields)
          .where(eq(settlementCompliance.sessionId, payload.sid))
          .returning();
      } else {
        [record] = await db
          .insert(settlementCompliance)
          .values({
            sessionId: payload.sid,
            complianceStatus: "in_progress",
            createdAt: now,
            ...updateFields,
          } as any)
          .returning();
      }

      return res.json(record);
    } catch (err: any) {
      console.error("POST /api/settlement/compliance/sign error:", err);
      return res.status(err?.message?.includes("Token") ? 401 : 500).json({ message: err?.message || "Failed to save signatures" });
    }
  });

  app.post("/api/settlement/compliance/pull-credit", async (req: Request, res: Response) => {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const now = new Date();

      const [existing] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      const updateFields = {
        creditReportStatus: "completed",
        creditReportRequestedAt: now,
        creditReportCompletedAt: now,
        updatedAt: now,
      };

      if (existing) {
        await db
          .update(settlementCompliance)
          .set(updateFields)
          .where(eq(settlementCompliance.sessionId, payload.sid));
      } else {
        await db
          .insert(settlementCompliance)
          .values({
            sessionId: payload.sid,
            complianceStatus: "in_progress",
            createdAt: now,
            ...updateFields,
          } as any);
      }

      return res.json({
        success: true,
        creditReportStatus: "completed",
        creditReportRequestedAt: now.toISOString(),
        creditReportCompletedAt: now.toISOString(),
      });
    } catch (err: any) {
      console.error("POST /api/settlement/compliance/pull-credit error:", err);
      return res.status(err?.message?.includes("Token") ? 401 : 500).json({ message: err?.message || "Failed to pull credit report" });
    }
  });

  app.post("/api/settlement/compliance/complete", async (req: Request, res: Response) => {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ message: "Missing token" });

      const secret = settlementSecretOrThrow();
      const payload = verifySettlementJwt(token, secret);

      const [record] = await db
        .select()
        .from(settlementCompliance)
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .limit(1);

      if (!record) {
        return res.status(400).json({ message: "No compliance record found. Please complete all steps first." });
      }

      const missing: string[] = [];
      if (!record.entityType) missing.push("entityType");
      if (!record.legalName) missing.push("legalName");
      if (!record.taxIdType) missing.push("taxIdType");
      if (!record.taxIdLast4) missing.push("taxIdLast4");
      if (!record.idPrimaryFileKey) missing.push("idPrimaryFileKey (primary identification document)");
      if (!record.accreditedInvestorAttested) missing.push("accreditedInvestorAttested");
      if (!record.holdHarmlessSigned) missing.push("holdHarmlessSigned");
      if (!record.privatePartySelfDirected) missing.push("privatePartySelfDirected");
      if (!record.creditAuthorizationSigned) missing.push("creditAuthorizationSigned");
      if (!record.signatureName) missing.push("signatureName");

      if (missing.length > 0) {
        return res.status(400).json({
          message: "Missing required compliance fields",
          missing,
        });
      }

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      const now = new Date();
      ensureUploadDir();

      const pdfBuffer = await renderSettlementCompliancePacketPdf({
        sessionId: payload.sid,
        tradeId: payload.tradeId,
        bondName: payload.bondName || session?.bondName,
        amount: payload.amount,
        investorEmail: payload.investorEmail || session?.investorEmail,
        entityType: record.entityType,
        legalName: record.legalName,
        taxIdType: record.taxIdType,
        taxIdLast4: record.taxIdLast4,
        idPrimaryOriginalName: record.idPrimaryOriginalName,
        idSecondaryOriginalName: record.idSecondaryOriginalName,
        creditReportStatus: record.creditReportStatus,
        creditReportOriginalName: record.creditReportOriginalName,
        creditReportRequestedAt: record.creditReportRequestedAt?.toISOString() || null,
        creditReportCompletedAt: record.creditReportCompletedAt?.toISOString() || null,
        creditAuthorizationSigned: record.creditAuthorizationSigned ?? false,
        creditAuthorizationSignedAt: record.creditAuthorizationSignedAt?.toISOString() || null,
        accreditedInvestorAttested: record.accreditedInvestorAttested ?? false,
        accreditedInvestorSignedAt: record.accreditedInvestorSignedAt?.toISOString() || null,
        holdHarmlessSigned: record.holdHarmlessSigned ?? false,
        holdHarmlessSignedAt: record.holdHarmlessSignedAt?.toISOString() || null,
        privatePartySelfDirected: record.privatePartySelfDirected ?? false,
        privatePartySelfDirectedSignedAt: record.privatePartySelfDirectedSignedAt?.toISOString() || null,
        signatureName: record.signatureName,
        signatureIp: record.signatureIp,
        completedAt: now.toISOString(),
      });

      const pdfFilename = `compliance-packet-${payload.sid}-${Date.now()}.pdf`;
      const pdfPath = path.join(UPLOAD_DIR, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);

      const [updated] = await db
        .update(settlementCompliance)
        .set({
          complianceStatus: "complete",
          compliancePacketFileKey: pdfFilename,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(settlementCompliance.sessionId, payload.sid))
        .returning();

      await db
        .update(settlementSessions)
        .set({
          complianceStatus: "complete",
          complianceCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(settlementSessions.sessionId, payload.sid));

      return res.json({
        success: true,
        complianceStatus: "complete",
        compliancePacketFileKey: pdfFilename,
        completedAt: now.toISOString(),
        record: updated,
      });
    } catch (err: any) {
      console.error("POST /api/settlement/compliance/complete error:", err);
      return res.status(err?.message?.includes("Token") ? 401 : 500).json({ message: err?.message || "Failed to complete compliance" });
    }
  });
}
