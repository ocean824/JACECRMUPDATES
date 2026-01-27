import crypto from "crypto";

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecodeToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export type OnboardingJwtPayload = {
  sid: string;
  inv: string;
  bInv?: string;
  email?: string;
  iat: number;
  exp: number;
};

export function signOnboardingJwt(payload: Omit<OnboardingJwtPayload, "iat" | "exp">, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: OnboardingJwtPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${signingInput}.${sigB64}`;
}

export function verifyOnboardingJwt(token: string, secret: string): OnboardingJwtPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(signingInput).digest();
  const expectedSigB64 = base64UrlEncode(expectedSig);
  const sigBuffer = Buffer.from(sigB64);
  const expectedBuffer = Buffer.from(expectedSigB64);
  if (sigBuffer.length !== expectedBuffer.length) {
    throw new Error("Invalid token signature");
  }
  if (!crypto.timingSafeEqual(expectedBuffer, sigBuffer)) {
    throw new Error("Invalid token signature");
  }
  let payloadJson: string;
  try {
    payloadJson = base64UrlDecodeToBuffer(payloadB64).toString("utf8");
  } catch {
    throw new Error("Invalid token payload");
  }
  let payload: OnboardingJwtPayload;
  try {
    payload = JSON.parse(payloadJson) as OnboardingJwtPayload;
  } catch {
    throw new Error("Invalid token payload");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) {
    throw new Error("Token expired");
  }
  return payload;
}

export function getEncryptionKeyFromBase64(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("JACE_ENCRYPTION_KEY_BASE64 must decode to 32 bytes (AES-256 key).");
  }
  return key;
}

export function encryptJsonAesGcm(jsonObj: unknown, key: Buffer): { ciphertextB64: string; ivHex: string; tagHex: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(jsonObj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: ciphertext.toString("base64"),
    ivHex: iv.toString("hex"),
    tagHex: tag.toString("hex"),
  };
}

export function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export function safeSplitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = (fullName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { firstName: "Investor", lastName: "" };
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}
