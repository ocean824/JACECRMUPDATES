import type { Express, Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
        bondAiInvestorRef, // Alternative field name from BondAI
        fullName,
        name, // Alternative field name from BondAI
        email,
        phone,
        returnUrl,
      } = req.body || {};

      // Accept both bondaiInvestorId and bondAiInvestorRef field names
      const investorExternalId = bondaiInvestorId || bondAiInvestorRef || `bondai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      
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

        const submittedIpAddress = Array.isArray(req.ip) ? req.ip[0] : (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";

        const kycUpdatePayload = {
          bondaiInvestorId: session.bondaiInvestorId || payload.bInv,
          jaceInvestorId: payload.inv,
          jaceSessionId: session.id,
          jaceSubmissionId: submission.id,
          status: "LIVE",
          completedAt: now.toISOString(),
          investor: {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            email,
            phone,
            address: {
              line1: addressLine1,
              line2: addressLine2 || null,
              city,
              state,
              postalCode,
              country,
            },
          },
          kyc: {
            kycVerified: true,
            kycVerifiedAt: now.toISOString(),
            kycStatus: "submitted",
            identityDocumentType: docType,
            identityDocumentSubmitted: true,
            identityFrontDocumentId: identityFrontDoc.id,
            identityBackDocumentId: identityBackDoc?.id || null,
            proofOfLifeSubmitted: true,
            proofOfLifeDocumentId: proofOfLifeDoc.id,
            documentsSubmittedCount: identityBackDoc ? 3 : 2,
          },
          signatures: {
            kycAttestationSigned: true,
            kycAttestationSignedAt: now.toISOString(),
            kycAttestationDocumentId: sigKycDoc.id,
            kycAttestationText: "I attest that I am the person named in this application, all information provided is true and accurate, and all documents submitted are authentic.",
            investorAgreementSigned: true,
            investorAgreementSignedAt: now.toISOString(),
            investorAgreementDocumentId: sigAgreementDoc.id,
            investorAgreementText: "I have read, understand, and agree to the Terms of Use, Privacy Policy, and Investor User Agreement between myself, JACE Management, LLC, and BondAI.",
            disclosureDisclaimerSigned: true,
            disclosureDisclaimerSignedAt: now.toISOString(),
            disclosureDisclaimerDocumentId: sigDisclosureDoc.id,
            disclosureDisclaimerText: "I acknowledge that I have reviewed and understand the Disclosures & Disclaimers regarding investment risks, regulatory requirements, and my obligations as an investor.",
            totalSignatures: 3,
          },
          agreements: {
            termsAccepted: true,
            termsAcceptedAt: now.toISOString(),
            termsOfUseVersion: "1.0",
            privacyPolicyAccepted: true,
            privacyPolicyAcceptedAt: now.toISOString(),
            privacyPolicyVersion: "1.0",
            electronicSignatureConsent: true,
            electronicSignatureConsentAt: now.toISOString(),
            electronicSignatureConsentText: "By signing below, you acknowledge that your electronic signatures are legally binding and have the same legal effect as a handwritten signature.",
            disclosuresAcknowledged: true,
            disclosuresAcknowledgedAt: now.toISOString(),
            disclosuresVersion: "1.0",
            userAgreementAccepted: true,
            userAgreementText: "I have read and agree to the Terms of Use, Privacy Policy, and Investor User Agreement. I authorize JACE Management, LLC and BondAI to process my onboarding data for investor verification and bond settlement purposes.",
            dataConsentAcknowledged: true,
            dataConsentText: "I acknowledge and consent that: (1) my submission is timestamped with my IP address, (2) my electronic signatures are legally binding, (3) my data may be shared between JACE and BondAI for compliance and auditing purposes, and (4) I have reviewed the Disclosures & Disclaimers regarding investment risks.",
          },
          banking: {
            bankingInfoSubmitted: true,
            accountType,
            bankName: bankName || null,
            bankAddress: bankAddress || null,
            bankPhone: bankPhone || null,
            routingNumberProvided: !!routingNumber,
            accountNumberProvided: !!accountNumber,
          },
          jaceOnboarding: {
            isJaceLive: true,
            jaceOnboardedAt: now.toISOString(),
            onboardingCompleted: true,
          },
          audit: {
            submittedAt: now.toISOString(),
            ipAddress: submittedIpAddress,
            userAgent: (req.headers["user-agent"] as string) || "",
          },
        };

        let webhookSent = false;
        let kycApiSuccess = false;

        // 1. Send comprehensive webhook to BondAI webhook endpoint
        if (webhookUrl) {
          const webhookBody = {
            event: "investor_onboarding_completed",
            ...kycUpdatePayload,
          };

          const raw = JSON.stringify(webhookBody);
          const ts = Math.floor(Date.now() / 1000).toString();
          const signature = webhookSecret ? hmacSha256Hex(webhookSecret, `${ts}.${raw}`) : "";

          try {
            const webhookResponse = await fetch(webhookUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(integrationApiKey ? { "x-api-key": integrationApiKey } : {}),
                ...(webhookSecret ? { "x-webhook-timestamp": ts, "x-webhook-signature": signature } : {}),
              },
              body: raw,
            });
            webhookSent = webhookResponse.ok;
            if (!webhookSent) {
              console.error(`BondAI webhook failed: ${webhookResponse.status}`);
            }
          } catch (e) {
            console.error("BondAI webhook call failed:", e);
          }
        }

        // 2. Direct API call to BondAI to update investor's KYC/onboarding fields
        const bondaiApiUrl = process.env.BONDAI_API_URL;
        const kycApiTargetUrl = bondaiApiUrl
          ? `${bondaiApiUrl}/api/jace/investor-kyc-update`
          : webhookUrl
            ? (() => { const derived = webhookUrl.replace(/\/api\/jace\/webhook.*$/, ""); return derived !== webhookUrl ? `${derived}/api/jace/investor-kyc-update` : null; })()
            : null;

        if (kycApiTargetUrl) {
          const apiPayload = {
            source: "JACE_CRM",
            event: "investor_kyc_update",
            timestamp: now.toISOString(),
            ...kycUpdatePayload,
          };

          const raw = JSON.stringify(apiPayload);
          const ts = Math.floor(Date.now() / 1000).toString();
          const signature = webhookSecret ? hmacSha256Hex(webhookSecret, `${ts}.${raw}`) : "";

          try {
            const apiResponse = await fetch(kycApiTargetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(integrationApiKey ? { "x-api-key": integrationApiKey } : {}),
                ...(webhookSecret ? { "x-webhook-timestamp": ts, "x-webhook-signature": signature } : {}),
              },
              body: raw,
            });
            kycApiSuccess = apiResponse.ok;
            if (kycApiSuccess) {
              console.log(`BondAI investor KYC update successful for ${email} via ${kycApiTargetUrl}`);
              await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `BondAI investor KYC update API call successful for investor ${payload.inv}`);
            } else {
              const errText = await apiResponse.text().catch(() => "");
              console.error(`BondAI investor KYC update failed: ${apiResponse.status} ${errText}`);
              await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `BondAI investor KYC update API call failed: ${apiResponse.status}`);
            }
          } catch (e: any) {
            console.error("BondAI investor KYC update API call error:", e?.message);
            await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `BondAI investor KYC update API call error: ${e?.message}`);
          }
        }

        // 3. Call POST /api/jace/webhook on BondAI to set isJaceLive and jaceOnboardedAt
        let jaceWebhookSuccess = false;
        const bondaiBase = bondaiApiUrl
          ? bondaiApiUrl.replace(/\/+$/, "")
          : webhookUrl
            ? webhookUrl.replace(/\/api\/.*$/, "")
            : null;
        const jaceWebhookTargetUrl = bondaiBase ? `${bondaiBase}/api/jace/webhook` : null;

        console.log(`[JACE WEBHOOK] Attempting POST /api/jace/webhook — bondaiApiUrl=${bondaiApiUrl || "NOT SET"}, webhookUrl=${webhookUrl || "NOT SET"}, resolved target=${jaceWebhookTargetUrl || "NULL"}, email=${email}`);

        if (jaceWebhookTargetUrl) {
          const jaceWebhookBody = {
            type: "investor.onboarding.completed",
            investorEmail: email,
            completedAt: now.toISOString(),
          };

          const jaceRaw = JSON.stringify(jaceWebhookBody);
          const jaceSignature = process.env.JACE_WEBHOOK_SECRET
            ? crypto.createHmac("sha256", process.env.JACE_WEBHOOK_SECRET).update(jaceRaw).digest("hex")
            : "";

          console.log(`[JACE WEBHOOK] Sending POST to ${jaceWebhookTargetUrl} with payload: ${jaceRaw}`);

          try {
            const jaceResp = await fetch(jaceWebhookTargetUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(jaceSignature ? { "X-Jace-Signature": jaceSignature } : {}),
              },
              body: jaceRaw,
            });
            jaceWebhookSuccess = jaceResp.ok;
            const respText = await jaceResp.text().catch(() => "");
            if (jaceWebhookSuccess) {
              console.log(`[JACE WEBHOOK] SUCCESS ${jaceResp.status} for ${email} — response: ${respText}`);
              await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `JACE webhook (investor.onboarding.completed) sent for investor ${payload.inv}`);
            } else {
              console.error(`[JACE WEBHOOK] FAILED ${jaceResp.status} for ${email} — response: ${respText}`);
              await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `JACE webhook failed: ${jaceResp.status} ${respText}`);
            }
          } catch (e: any) {
            console.error(`[JACE WEBHOOK] ERROR for ${email}: ${e?.message}`);
            await logAudit(ownerUserId, "update", "bondai_integration", submission.id, `JACE webhook call error: ${e?.message}`);
          }
        } else {
          console.error(`[JACE WEBHOOK] SKIPPED — no target URL could be resolved. Set BONDAI_API_URL or BONDAI_WEBHOOK_URL env var.`);
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
          bondaiNotified: webhookSent || kycApiSuccess || jaceWebhookSuccess,
          bondaiWebhookSent: webhookSent,
          bondaiKycApiSuccess: kycApiSuccess,
          jaceWebhookSent: jaceWebhookSuccess,
          kycUpdate: {
            kycVerified: true,
            isJaceLive: true,
            jaceOnboardedAt: now.toISOString(),
          },
        });
      } catch (err: any) {
        console.error("External onboarding submit error:", err);
        return res.status(400).json({ message: err?.message || "Submission failed" });
      }
    },
  );

  // AI Onboarding Assistant - comprehensive, contextual guidance
  app.post("/api/external/onboarding/assistant", async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory = [], currentProgress = {} } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Validate message length
      if (message.length > 1000) {
        return res.status(400).json({ error: "Message too long. Please keep it under 1000 characters." });
      }

      // Limit conversation history
      const limitedHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];

      // Check for required env vars
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        console.error("AI integration env vars not configured");
        return res.status(503).json({ error: "AI assistant temporarily unavailable" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are JACE AI, a friendly, knowledgeable, and helpful onboarding assistant for JACE CRM's investor onboarding process. You work for JACE Management, LLC, a Colorado-based financial services company that partners with BondAI for bond investment management.

## Your Role
- Guide investors through the complete onboarding process
- Answer ANY question about onboarding, documents, legal requirements, or the process
- Be warm, professional, and reassuring - many investors are nervous about compliance
- Provide step-by-step guidance when asked
- Remember context from the conversation to give personalized help

## The Onboarding Process (Complete Knowledge)
Investors must complete these steps to go LIVE on BondAI:

### 1. Personal Information
- Full legal name (first and last)
- Email address (pre-filled from BondAI)
- Phone number with country code
- This info must match government-issued ID exactly

### 2. Home Address
- Complete US mailing address required
- Street address, city, state, ZIP code, country
- Must be a residential address (not P.O. Box for primary)
- This is used for tax reporting and compliance

### 3. Identity Verification (KYC - Know Your Customer)
Two document types accepted:
- **Driver's License**: Upload BOTH front and back images (high-quality photos or scans)
- **Passport**: Upload only the main page with photo and info

Requirements:
- Must be unexpired, government-issued
- Clear, legible photos (no blur, glare, or shadows)
- Entire document visible in frame
- File types: JPG, PNG, PDF (max 10MB each)

### 4. Proof of Life (Liveness Verification)
- Upload a recent selfie or short video
- Purpose: Verify you are a real person and match your ID
- Face must be clearly visible, well-lit
- Can be a photo or video file

### 5. User Agreement & Acknowledgements
- Accept the JACE User Agreement
- Acknowledge understanding of investment risks
- Both checkboxes must be checked to proceed

### 6. Legal Document Signing (Compliance)
Three required legal documents:
- **AML Certification** (Anti-Money Laundering - USA PATRIOT Act / Bank Secrecy Act)
- **CIP/KYC Privacy Consent** (Gramm-Leach-Bliley Act compliance)
- **Privacy Short Form** (GLBA Model Privacy Notice)

For each document:
- Must scroll to the bottom to enable signing
- Click "Sign Document" after reading
- Documents are legally binding

### 7. Banking Information
For receiving investment returns:
- **Account Type**: Personal or Trust account
- **Bank Name**: Full legal name of your bank
- **Bank Address**: Branch address
- **Bank Phone**: Bank's customer service number
- **Routing Number**: 9-digit ABA routing number
- **Account Number**: Your account number

Important: Double-check all digits! Errors cause payment delays.

### 8. Electronic Signatures (3 Required)
Three signature pads at the bottom:
- **KYC Signature**: Certifies identity documents are authentic
- **Agreement Signature**: Confirms acceptance of user agreement
- **Disclosure Signature**: Acknowledges receipt of disclosures

Tips for signing:
- Use mouse/trackpad or finger on touchscreen
- Draw your actual signature
- Click "Clear" to redo if needed
- Must complete all three to submit

## After Submission
- JACE reviews documents (usually 1-2 business days)
- You receive confirmation email from JACE
- BondAI is automatically notified via secure webhook
- Your account status changes to "LIVE"
- All investing features on BondAI become unlocked

## Technical & Security Info
- All data encrypted in transit (TLS) and at rest (AES-256)
- Submissions are timestamped with IP for compliance audit trail
- JACE Management, LLC is the data controller
- Contact: jacemgmt@gmail.com or 970-710-9193

## Current User Progress
${JSON.stringify(currentProgress, null, 2)}

## Guidelines for Responses
- Be concise but complete (2-4 sentences usually)
- Use simple, everyday language - avoid jargon
- If unsure about something, say so and suggest they contact support
- For technical issues, suggest refreshing the page or using a different browser
- Always be encouraging - "You're almost there!" etc.
- If they seem stuck, proactively suggest the next step`;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Add conversation history for memory (already limited)
      for (const msg of limitedHistory) {
        if (msg.from === "you" || msg.from === "user") {
          messages.push({ role: "user", content: String(msg.text || "").slice(0, 500) });
        } else if (msg.from === "assistant") {
          messages.push({ role: "assistant", content: String(msg.text || "").slice(0, 1000) });
        }
      }

      messages.push({ role: "user", content: message });

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        stream: true,
        max_tokens: 512,
        temperature: 0.7,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("AI assistant error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "I'm having trouble responding right now. Please try again or contact support at jacemgmt@gmail.com" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to get AI response" });
      }
    }
  });

  // Voice Assistant endpoint - accepts audio, returns AI response with TTS
  app.post("/api/external/onboarding/voice-assistant", async (req: Request, res: Response) => {
    try {
      const { audio, conversationHistory = [], currentProgress = {} } = req.body;

      if (!audio || typeof audio !== "string") {
        return res.status(400).json({ error: "Audio data is required" });
      }

      // Check for required env vars
      if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        console.error("AI integration env vars not configured");
        return res.status(503).json({ error: "Voice assistant temporarily unavailable" });
      }

      // Import audio utilities
      const { ensureCompatibleFormat, speechToText, textToSpeechStream } = await import("./replit_integrations/audio/client");
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // Convert base64 audio to buffer and ensure compatible format
      const audioBuffer = Buffer.from(audio, "base64");
      const { buffer: wavBuffer, format } = await ensureCompatibleFormat(audioBuffer);

      // Transcribe user's speech
      const userTranscript = await speechToText(wavBuffer, format);

      if (!userTranscript || userTranscript.trim().length === 0) {
        return res.status(400).json({ error: "Could not understand audio. Please try again." });
      }

      // Limit conversation history
      const limitedHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];

      const systemPrompt = `You are JACE AI, a friendly voice assistant for investor onboarding. Keep responses SHORT (1-2 sentences) since they will be spoken aloud. Be warm and helpful.

## Current User Progress
${JSON.stringify(currentProgress, null, 2)}

## Key Info
- Guide investors through the onboarding steps: personal info, address, identity docs, proof of life, agreements, legal docs, banking info, and signatures
- All data is encrypted and secure
- Contact: jacemgmt@gmail.com or 970-710-9193`;

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Add conversation history
      for (const msg of limitedHistory) {
        if (msg.from === "you" || msg.from === "user") {
          messages.push({ role: "user", content: String(msg.text || "").slice(0, 500) });
        } else if (msg.from === "assistant") {
          messages.push({ role: "assistant", content: String(msg.text || "").slice(0, 500) });
        }
      }

      messages.push({ role: "user", content: userTranscript });

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send user transcript first
      res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userTranscript })}\n\n`);

      // Get AI text response (non-streaming for TTS)
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      const responseText = chatResponse.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      // Send text transcript
      res.write(`data: ${JSON.stringify({ type: "transcript", data: responseText })}\n\n`);

      // Stream TTS audio
      const audioStream = await textToSpeechStream(responseText, "nova");
      for await (const chunk of audioStream) {
        res.write(`data: ${JSON.stringify({ type: "audio", data: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Voice assistant error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Voice processing failed. Please try again." })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process voice request" });
      }
    }
  });
}
