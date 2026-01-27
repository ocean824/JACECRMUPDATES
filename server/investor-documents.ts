import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import { db } from "./db";
import { investorDocuments, complianceAuditEvents, investors } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { renderLegalPdf } from "./lib/pdf/renderLegalPdf";
import { LEGAL_DOCUMENTS, type LegalDocumentType } from "@shared/legal-documents";

const SignInvestorDocumentBody = z.object({
  investorId: z.string().min(1),
  documentType: z.enum(["AML_CERTIFICATION", "CIP_KYC_PRIVACY_CONSENT", "PRIVACY_SHORTFORM"]),
  signerName: z.string().min(2),
  signerEmail: z.string().email().optional().nullable(),
  signerTitle: z.string().optional().nullable(),
  signatureMethod: z.enum(["TYPED", "DRAWN"]).default("TYPED"),
  signatureValue: z.string().optional().nullable(),
  consentSnapshot: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

function getClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const ips = Array.isArray(xff) ? xff[0] : xff;
    return ips.split(",")[0].trim();
  }
  return req.headers["x-real-ip"] as string || req.socket.remoteAddress || null;
}

export function registerInvestorDocumentRoutes(app: Express, isAuthenticated: (req: Request, res: Response, next: () => void) => void) {
  
  app.post("/api/investor-documents/sign", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const body = SignInvestorDocumentBody.parse(req.body);
      const ip = getClientIp(req);
      const userAgent = req.headers["user-agent"] || null;
      const sessionId = (req as any).sessionID || null;

      const investorRows = await db
        .select()
        .from(investors)
        .where(and(eq(investors.id, body.investorId), eq(investors.userId, userId)))
        .limit(1);

      if (investorRows.length === 0) {
        return res.status(404).json({ message: "Investor not found" });
      }

      const investor = investorRows[0];
      const legalDoc = LEGAL_DOCUMENTS[body.documentType as LegalDocumentType];
      
      if (!legalDoc) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      const signedAtISO = new Date().toISOString();

      const pdfBytes = await renderLegalPdf({
        companyName: "JACE Management, LLC",
        companyState: "Colorado",
        contactEmail: "jacemgmt@gmail.com",
        contactPhone: "970-710-9193",
        governingState: "Colorado",
        investorId: body.investorId,
        documentType: body.documentType,
        version: legalDoc.version,
        title: legalDoc.title,
        documentBody: legalDoc.body,
        signerName: body.signerName,
        signerEmail: body.signerEmail,
        signerTitle: body.signerTitle,
        signatureMethod: body.signatureMethod,
        signatureValue: body.signatureValue,
        consentSnapshot: body.consentSnapshot as Record<string, unknown>,
        metadata: body.metadata as Record<string, unknown>,
        signedAtISO,
        ip,
        userAgent,
        sessionId,
      });

      const sha256Hex = crypto.createHash("sha256").update(pdfBytes).digest("hex");

      const dir = path.join(process.cwd(), "uploads", "investors", body.investorId);
      await fs.mkdir(dir, { recursive: true });

      const filename = `${body.documentType}_v${legalDoc.version}_${Date.now()}.pdf`;
      const filePath = path.join(dir, filename);
      await fs.writeFile(filePath, pdfBytes);

      const fileKey = `uploads/investors/${body.investorId}/${filename}`;
      const fileSizeBytes = pdfBytes.length;

      const [insertedDoc] = await db.insert(investorDocuments).values({
        userId,
        investorId: body.investorId,
        documentType: body.documentType,
        version: legalDoc.version,
        title: legalDoc.title,
        status: "SIGNED",
        fileKey,
        fileMime: "application/pdf",
        fileSizeBytes,
        sha256Hex,
        signerName: body.signerName,
        signerEmail: body.signerEmail,
        signerTitle: body.signerTitle,
        signatureMethod: body.signatureMethod,
        signatureValue: body.signatureValue,
        consentSnapshot: JSON.stringify(body.consentSnapshot),
        metadata: JSON.stringify(body.metadata),
        signedIp: ip,
        signedUserAgent: userAgent,
        signedSessionId: sessionId,
      }).returning();

      await db.insert(complianceAuditEvents).values({
        userId,
        investorId: body.investorId,
        eventType: "DOC_SIGNED",
        documentId: insertedDoc.id,
        description: `Signed ${legalDoc.title} (${body.documentType})`,
        ipAddress: ip,
        userAgent,
        metadata: JSON.stringify({
          documentType: body.documentType,
          version: legalDoc.version,
          fileKey,
          sha256Hex,
        }),
      });

      return res.json({
        documentId: insertedDoc.id,
        documentType: body.documentType,
        title: legalDoc.title,
        signedAt: insertedDoc.signedAt,
        fileKey,
      });
    } catch (err: any) {
      console.error("Error signing investor document:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      return res.status(500).json({ message: err?.message || "Failed to sign document" });
    }
  });

  app.get("/api/investor-documents/:investorId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { investorId } = req.params;

      const investorRows = await db
        .select()
        .from(investors)
        .where(and(eq(investors.id, investorId), eq(investors.userId, userId)))
        .limit(1);

      if (investorRows.length === 0) {
        return res.status(404).json({ message: "Investor not found" });
      }

      const docs = await db
        .select()
        .from(investorDocuments)
        .where(and(eq(investorDocuments.investorId, investorId), eq(investorDocuments.userId, userId)))
        .orderBy(desc(investorDocuments.signedAt));

      return res.json(docs);
    } catch (err: any) {
      console.error("Error fetching investor documents:", err);
      return res.status(500).json({ message: err?.message || "Failed to fetch documents" });
    }
  });

  app.get("/api/investor-documents/:investorId/:documentId/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId = user?.claims?.sub || user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { investorId, documentId } = req.params;

      const investorRows = await db
        .select()
        .from(investors)
        .where(and(eq(investors.id, investorId), eq(investors.userId, userId)))
        .limit(1);

      if (investorRows.length === 0) {
        return res.status(404).json({ message: "Investor not found" });
      }

      const docRows = await db
        .select()
        .from(investorDocuments)
        .where(and(
          eq(investorDocuments.id, documentId),
          eq(investorDocuments.investorId, investorId),
          eq(investorDocuments.userId, userId)
        ))
        .limit(1);

      if (docRows.length === 0) {
        return res.status(404).json({ message: "Document not found" });
      }

      const doc = docRows[0];
      const filePath = path.join(process.cwd(), doc.fileKey);

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ message: "File not found on disk" });
      }

      const ip = getClientIp(req);
      const userAgent = req.headers["user-agent"] || null;

      await db.insert(complianceAuditEvents).values({
        userId,
        investorId,
        eventType: "DOC_DOWNLOADED",
        documentId: doc.id,
        description: `Downloaded ${doc.title}`,
        ipAddress: ip,
        userAgent,
      });

      res.setHeader("Content-Type", doc.fileMime);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.title.replace(/[^a-zA-Z0-9]/g, "_")}_${doc.version}.pdf"`);

      const fileBuffer = await fs.readFile(filePath);
      return res.send(fileBuffer);
    } catch (err: any) {
      console.error("Error downloading investor document:", err);
      return res.status(500).json({ message: err?.message || "Failed to download document" });
    }
  });
}
