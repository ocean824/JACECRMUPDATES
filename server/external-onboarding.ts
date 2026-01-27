import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { externalOnboardingSessions, investors, investorOnboardingSubmissions, documents, kycChecklist } from "@shared/schema";
import { storage, logAudit } from "./storage";
import multer from "multer";
import {
  encryptJsonAesGcm,
  getEncryptionKeyFromBase64,
  hmacSha256Hex,
  safeSplitFullName,
  signOnboardingJwt,
  verifyOnboardingJwt,
} from "./external-onboarding-security";
import { sendInvestorOnboardingCompletedEmail } from "./external-onboarding-email";

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: images, PDFs, and videos.`));
    }
  },
});

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function computePublicBaseUrl(req: Request): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  const allowed = (process.env.BONDAI_CORS_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!origin || allowed.length === 0) return false;
  return allowed.includes(origin);
}

function setCorsHeaders(req: Request, res: Response) {
  const origin = req.headers.origin as string | undefined;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-KEY, X-Integration-Key, X-Webhook-Signature, X-Webhook-Timestamp");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
}

function setFrameAncestorsHeaders(req: Request, res: Response) {
  const fa = process.env.BONDAI_ALLOWED_FRAME_ANCESTORS;
  if (fa) {
    res.setHeader("Content-Security-Policy", `frame-ancestors ${fa};`);
  }
}

async function writeBase64PngToUploads(dataUrl: string, prefix: string): Promise<{ filepath: string; filename: string; size: number }> {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Invalid signature format");
  const buf = Buffer.from(match[1], "base64");
  const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
  const filepath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filepath, buf);
  return { filepath, filename, size: buf.length };
}

async function createDocumentRecord(params: {
  userId: string;
  investorId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  description?: string;
}) {
  const [doc] = await db
    .insert(documents)
    .values({
      userId: params.userId,
      investorId: params.investorId,
      filename: params.filename,
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: params.size,
      category: params.category,
      description: params.description,
    })
    .returning();
  return doc;
}

export function registerExternalOnboarding(app: Express) {
  app.use((req, res, next) => {
    if (req.path === "/external/onboarding" || req.path.startsWith("/external/onboarding/")) {
      setFrameAncestorsHeaders(req, res);
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.options("/api/external/onboarding/sessions", (req, res) => {
    setCorsHeaders(req, res);
    return res.status(204).send();
  });

  app.options("/api/integrations/bondai/handoff", (req, res) => {
    setCorsHeaders(req, res);
    return res.status(204).send();
  });

  // Handler for creating onboarding sessions - shared between both endpoints
  const handleCreateOnboardingSession = async (req: Request, res: Response) => {
    setCorsHeaders(req, res);
    try {
      // Accept both X-API-KEY and X-Integration-Key headers for compatibility
      const apiKey = req.header("x-api-key") || req.header("x-integration-key");
      const expected = envOrThrow("BONDAI_INTEGRATION_API_KEY");
      if (!apiKey || apiKey !== expected) {
        console.error("BondAI handoff auth failed - received key:", apiKey?.substring(0, 10) + "...", "expected:", expected.substring(0, 10) + "...");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const ownerUserId = envOrThrow("ONBOARDING_DEFAULT_OWNER_USER_ID");
      const jwtSecret = envOrThrow("JACE_ONBOARDING_JWT_SECRET");

      const {
        bondaiInvestorId,
        fullName,
        name, // Alternative field name from BondAI
        email,
        phone,
        returnUrl,
      } = req.body || {};

      // bondaiInvestorId is optional - generate one if not provided
      const investorExternalId = bondaiInvestorId || `bondai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      
      // Use fullName or name field
      const investorFullName = fullName || name || "";

      const existing = await db
        .select()
        .from(investors)
        .where(and(eq(investors.userId, ownerUserId), eq(investors.email, email)))
        .limit(1);

      let investor = existing[0];
      if (!investor) {
        const parsedName = safeSplitFullName(investorFullName);
        investor = await storage.createInvestor(ownerUserId, {
          investorType: "individual",
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          email,
          phone: phone || null,
          company: null,
          pipelineStage: "kyc_pending",
          kycStatus: "pending",
          investmentAmount: null,
          notes: `External onboarding initiated from BondAI (bondaiInvestorId=${investorExternalId}).`,
        } as any);
      }

      const ttlSeconds = 2 * 60 * 60;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const [session] = await db
        .insert(externalOnboardingSessions)
        .values({
          userId: ownerUserId,
          investorId: investor.id,
          bondaiInvestorId: investorExternalId,
          email,
          status: "created",
          expiresAt,
          returnUrl: returnUrl || null,
        } as any)
        .returning();

      const token = signOnboardingJwt(
        { sid: session.id, inv: investor.id, bInv: investorExternalId, email },
        jwtSecret,
        ttlSeconds,
      );

      const baseUrl = computePublicBaseUrl(req);
      const onboardingUrl = `${baseUrl}/external/onboarding?token=${encodeURIComponent(token)}`;

      return res.json({
        sessionId: session.id,
        investorId: investor.id,
        expiresAt: expiresAt.toISOString(),
        onboardingUrl,
        returnUrl: returnUrl || null,
      });
    } catch (err: any) {
      console.error("Error creating external onboarding session:", err);
      return res.status(500).json({ message: err?.message || "Failed to create session" });
    }
  };

  // Register both endpoints for creating onboarding sessions
  app.post("/api/external/onboarding/sessions", handleCreateOnboardingSession);
  app.post("/api/integrations/bondai/handoff", handleCreateOnboardingSession);

  app.options("/api/external/onboarding/session", (req, res) => {
    setCorsHeaders(req, res);
    return res.status(204).send();
  });

  app.get("/api/external/onboarding/session", async (req, res) => {
    setCorsHeaders(req, res);
    try {
      const jwtSecret = envOrThrow("JACE_ONBOARDING_JWT_SECRET");
      const token = (req.query.token as string) || "";
      if (!token) return res.status(400).json({ message: "token is required" });

      const payload = verifyOnboardingJwt(token, jwtSecret);
      const sessionRows = await db
        .select()
        .from(externalOnboardingSessions)
        .where(eq(externalOnboardingSessions.id, payload.sid))
        .limit(1);

      const session = sessionRows[0];
      if (!session) return res.status(404).json({ message: "session not found" });
      if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ message: "session expired" });
      }

      const investorRows = await db
        .select()
        .from(investors)
        .where(eq(investors.id, payload.inv))
        .limit(1);
      const investor = investorRows[0];
      if (!investor) return res.status(404).json({ message: "investor not found" });

      return res.json({
        session: {
          id: session.id,
          status: session.status,
          expiresAt: session.expiresAt,
          completedAt: session.completedAt,
          bondaiInvestorId: session.bondaiInvestorId,
          returnUrl: (session as any).returnUrl || null,
        },
        investor: {
          id: investor.id,
          firstName: investor.firstName,
          lastName: investor.lastName,
          email: investor.email,
          phone: investor.phone,
          addressLine1: (investor as any).addressLine1,
          addressLine2: (investor as any).addressLine2,
          city: (investor as any).city,
          state: (investor as any).state,
          postalCode: (investor as any).postalCode,
          country: (investor as any).country,
        },
      });
    } catch (err: any) {
      return res.status(401).json({ message: err?.message || "Invalid token" });
    }
  });

  app.options("/api/external/onboarding/submit", (req, res) => {
    setCorsHeaders(req, res);
    return res.status(204).send();
  });

  app.post(
    "/api/external/onboarding/submit",
    upload.fields([
      { name: "identityFront", maxCount: 1 },
      { name: "identityBack", maxCount: 1 },
      { name: "proofOfLife", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      setCorsHeaders(req, res);
      try {
        const jwtSecret = envOrThrow("JACE_ONBOARDING_JWT_SECRET");
        const encKey = getEncryptionKeyFromBase64(envOrThrow("JACE_ENCRYPTION_KEY_BASE64"));
        const ownerUserId = envOrThrow("ONBOARDING_DEFAULT_OWNER_USER_ID");

        const token = (req.body?.token as string) || "";
        if (!token) return res.status(400).json({ message: "token is required" });

        const payload = verifyOnboardingJwt(token, jwtSecret);

        const sessionRows = await db
          .select()
          .from(externalOnboardingSessions)
          .where(eq(externalOnboardingSessions.id, payload.sid))
          .limit(1);
        const session = sessionRows[0];
        if (!session) return res.status(404).json({ message: "session not found" });

        const required = (name: string) => {
          const v = (req.body?.[name] as string) || "";
          if (!v.trim()) throw new Error(`${name} is required`);
          return v.trim();
        };

        const firstName = required("firstName");
        const lastName = required("lastName");
        const email = required("email");
        const phone = required("phone");

        const addressLine1 = required("addressLine1");
        const addressLine2 = ((req.body?.addressLine2 as string) || "").trim() || null;
        const city = required("city");
        const state = required("state");
        const postalCode = required("postalCode");
        const country = ((req.body?.country as string) || "United States").trim();

        const docType = required("kycDocType");
        const accountType = required("bankAccountType");
        const routingNumber = required("routingNumber");
        const accountNumber = required("accountNumber");
        const bankName = required("bankName");
        const bankAddress = required("bankAddress");
        const bankPhone = required("bankPhone");

        const agreeUserAgreement = required("agreeUserAgreement");
        const acknowledge = required("acknowledge");
        if (agreeUserAgreement !== "true" || acknowledge !== "true") {
          throw new Error("Agreements must be accepted");
        }

        const signatureKyc = required("signatureKyc");
        const signatureAgreement = required("signatureAgreement");
        const signatureDisclosure = required("signatureDisclosure");

        const files = req.files as Record<string, Express.Multer.File[]> | undefined;

        const identityFront = files?.identityFront?.[0];
        const identityBack = files?.identityBack?.[0];
        const proofOfLife = files?.proofOfLife?.[0];

        if (!identityFront) throw new Error("identityFront file is required");
        if (docType === "drivers_license" && !identityBack) throw new Error("identityBack file is required for driver's license");
        if (!proofOfLife) throw new Error("proofOfLife file is required");

        await db
          .update(investors)
          .set({
            firstName,
            lastName,
            email,
            phone,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            pipelineStage: "ready",
            kycStatus: "submitted",
            updatedAt: new Date(),
          } as any)
          .where(eq(investors.id, payload.inv));

        const identityFrontDoc = await createDocumentRecord({
          userId: ownerUserId,
          investorId: payload.inv,
          filename: identityFront.filename,
          originalName: identityFront.originalname,
          mimeType: identityFront.mimetype,
          size: identityFront.size,
          category: "kyc_identity",
          description: `Identity (${docType}) - front`,
        });

        let identityBackDoc: any = null;
        if (identityBack) {
          identityBackDoc = await createDocumentRecord({
            userId: ownerUserId,
            investorId: payload.inv,
            filename: identityBack.filename,
            originalName: identityBack.originalname,
            mimeType: identityBack.mimetype,
            size: identityBack.size,
            category: "kyc_identity",
            description: `Identity (${docType}) - back`,
          });
        }

        const proofOfLifeDoc = await createDocumentRecord({
          userId: ownerUserId,
          investorId: payload.inv,
          filename: proofOfLife.filename,
          originalName: proofOfLife.originalname,
          mimeType: proofOfLife.mimetype,
          size: proofOfLife.size,
          category: "kyc_proof_of_life",
          description: "Proof of Life document",
        });

        const sig1 = await writeBase64PngToUploads(signatureKyc, "sig-kyc");
        const sig2 = await writeBase64PngToUploads(signatureAgreement, "sig-agreement");
        const sig3 = await writeBase64PngToUploads(signatureDisclosure, "sig-disclosure");

        const sigKycDoc = await createDocumentRecord({
          userId: ownerUserId,
          investorId: payload.inv,
          filename: sig1.filename,
          originalName: "signature_kyc.png",
          mimeType: "image/png",
          size: sig1.size,
          category: "signature",
          description: "KYC attestation signature",
        });

        const sigAgreementDoc = await createDocumentRecord({
          userId: ownerUserId,
          investorId: payload.inv,
          filename: sig2.filename,
          originalName: "signature_investor_jace_agreement.png",
          mimeType: "image/png",
          size: sig2.size,
          category: "signature",
          description: "Investor & JACE agreement signature",
        });

        const sigDisclosureDoc = await createDocumentRecord({
          userId: ownerUserId,
          investorId: payload.inv,
          filename: sig3.filename,
          originalName: "signature_disclosure_disclaimer.png",
          mimeType: "image/png",
          size: sig3.size,
          category: "signature",
          description: "Disclosure & disclaimer signature",
        });

        const now = new Date();
        await db.insert(kycChecklist).values([
          {
            userId: ownerUserId,
            investorId: payload.inv,
            itemName: "Proof of Identity",
            description: `Submitted identity documents (${docType}).`,
            status: "submitted",
            completedAt: now,
            documentId: identityFrontDoc.id,
            notes: identityBackDoc ? `Back doc id: ${identityBackDoc.id}` : null,
          } as any,
          {
            userId: ownerUserId,
            investorId: payload.inv,
            itemName: "Proof of Life",
            description: "Submitted proof of life document.",
            status: "submitted",
            completedAt: now,
            documentId: proofOfLifeDoc.id,
            notes: null,
          } as any,
          {
            userId: ownerUserId,
            investorId: payload.inv,
            itemName: "Signed Agreements",
            description: "Investor signed required agreements and disclosures.",
            status: "submitted",
            completedAt: now,
            documentId: sigAgreementDoc.id,
            notes: `Disclosure sig doc id: ${sigDisclosureDoc.id}; KYC sig doc id: ${sigKycDoc.id}`,
          } as any,
        ]);

        const ipAddress = Array.isArray(req.ip) ? req.ip[0] : (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
        const userAgent = (req.headers["user-agent"] as string) || "";

        const submissionPayload = {
          investor: {
            firstName,
            lastName,
            email,
            phone,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
          },
          kyc: {
            docType,
            identityFrontDocumentId: identityFrontDoc.id,
            identityBackDocumentId: identityBackDoc?.id || null,
            proofOfLifeDocumentId: proofOfLifeDoc.id,
            signatureKycDocumentId: sigKycDoc.id,
            kycAttestationText: "I attest that I am the person named in this application, all information provided is true and accurate, and all documents submitted are authentic.",
          },
          agreements: {
            agreeUserAgreement: true,
            agreeUserAgreementText: "I have read and agree to the Terms of Use, Privacy Policy, and Investor User Agreement. I authorize JACE Management, LLC and BondAI to process my onboarding data for investor verification and bond settlement purposes.",
            acknowledge: true,
            acknowledgeText: "I acknowledge and consent that: (1) my submission is timestamped with my IP address, (2) my electronic signatures are legally binding, (3) my data may be shared between JACE and BondAI for compliance and auditing purposes, and (4) I have reviewed the Disclosures & Disclaimers regarding investment risks.",
            signatureAgreementDocumentId: sigAgreementDoc.id,
            signatureAgreementText: "I have read, understand, and agree to the Terms of Use, Privacy Policy, and Investor User Agreement between myself, JACE Management, LLC, and BondAI.",
            signatureDisclosureDocumentId: sigDisclosureDoc.id,
            signatureDisclosureText: "I acknowledge that I have reviewed and understand the Disclosures & Disclaimers regarding investment risks, regulatory requirements, and my obligations as an investor.",
            termsOfUseVersion: "1.0",
            privacyPolicyVersion: "1.0",
            disclosuresVersion: "1.0",
            electronicSignatureConsent: true,
            electronicSignatureConsentText: "By signing below, you acknowledge that your electronic signatures are legally binding and have the same legal effect as a handwritten signature.",
          },
          banking: {
            accountType,
            routingNumber,
            accountNumber,
            bankName,
            bankAddress,
            bankPhone,
          },
          audit: {
            submittedAt: now.toISOString(),
            ipAddress,
            userAgent,
            bondaiInvestorId: session.bondaiInvestorId || payload.bInv || null,
          },
        };

        const enc = encryptJsonAesGcm(submissionPayload, encKey);

        const [submission] = await db
          .insert(investorOnboardingSubmissions)
          .values({
            sessionId: session.id,
            userId: ownerUserId,
            investorId: payload.inv,
            bondaiInvestorId: session.bondaiInvestorId || payload.bInv || null,
            ipAddress,
            userAgent,
            payloadCiphertext: enc.ciphertextB64,
            payloadIv: enc.ivHex,
            payloadTag: enc.tagHex,
          })
          .returning();

        await db
          .update(externalOnboardingSessions)
          .set({ status: "submitted", completedAt: now })
          .where(eq(externalOnboardingSessions.id, session.id));

        await logAudit(ownerUserId, "update", "external_onboarding", session.id, `External onboarding completed for investor ${payload.inv}.`);

        const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
        const webhookSecret = process.env.BONDAI_WEBHOOK_SECRET;
        const integrationApiKey = process.env.BONDAI_INTEGRATION_API_KEY;

        if (webhookUrl) {
          const event = "investor_onboarding_completed";
          const webhookBody = {
            event,
            bondaiInvestorId: session.bondaiInvestorId || payload.bInv,
            jaceInvestorId: payload.inv,
            jaceSessionId: session.id,
            jaceSubmissionId: submission.id,
            status: "LIVE",
            completedAt: now.toISOString(),
            investorEmail: email,
            investorName: `${firstName} ${lastName}`.trim(),
            kycStatus: "submitted",
            documentsSubmitted: {
              identityDocument: true,
              proofOfLife: true,
              signatures: 3,
              acknowledgements: 2,
            },
          };

          const raw = JSON.stringify(webhookBody);
          const ts = Math.floor(Date.now() / 1000).toString();

          const signature = webhookSecret ? hmacSha256Hex(webhookSecret, `${ts}.${raw}`) : "";

          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(integrationApiKey ? { "x-api-key": integrationApiKey } : {}),
              ...(webhookSecret ? { "x-webhook-timestamp": ts, "x-webhook-signature": signature } : {}),
            },
            body: raw,
          }).catch((e) => {
            console.error("BondAI webhook call failed:", e);
          });
        }

        await sendInvestorOnboardingCompletedEmail({
          toEmail: email,
          investorName: `${firstName} ${lastName}`.trim(),
          bondaiInvestorId: session.bondaiInvestorId || payload.bInv || "",
          jaceInvestorId: payload.inv,
        });

        return res.json({
          ok: true,
          submissionId: submission.id,
          completedAt: now.toISOString(),
        });
      } catch (err: any) {
        console.error("External onboarding submit error:", err);
        return res.status(400).json({ message: err?.message || "Submission failed" });
      }
    },
  );
}
