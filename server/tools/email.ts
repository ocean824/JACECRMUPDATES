import { Resend } from "resend";
import type { ToolContext } from "./types";

type SendEmailArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

const ALLOWED_RECIPIENT_DOMAINS = new Set([
  "jace.ai",
  "jacemgmt.com",
  "judgmentbonds.com",
]);

const EMAIL_RATE_LIMIT_WINDOW_MS = 60_000;
const EMAIL_RATE_LIMIT_MAX = 10;
const emailRateMap = new Map<string, { count: number; windowStart: number }>();

function checkEmailRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = emailRateMap.get(key);
  if (!entry || now - entry.windowStart > EMAIL_RATE_LIMIT_WINDOW_MS) {
    emailRateMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= EMAIL_RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

function isAllowedRecipient(email: string): boolean {
  const allowExternal = process.env.AGENT_EMAIL_ALLOW_EXTERNAL === "true";
  if (allowExternal) return true;

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return ALLOWED_RECIPIENT_DOMAINS.has(domain);
}

export async function sendEmail(args: SendEmailArgs, ctx: ToolContext) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY must be set to use sendEmail");

  if (!args?.to || !args?.subject) {
    throw new Error("sendEmail: 'to' and 'subject' are required");
  }

  if (!ctx.userId) {
    throw new Error("sendEmail: authenticated user context required");
  }

  if (!isAllowedRecipient(args.to)) {
    throw new Error(`sendEmail: recipient domain not in allowlist. Set AGENT_EMAIL_ALLOW_EXTERNAL=true to allow external recipients.`);
  }

  const rateLimitKey = `agent:${ctx.userId ?? "unknown"}`;
  if (!checkEmailRateLimit(rateLimitKey)) {
    throw new Error(`sendEmail: rate limit exceeded (max ${EMAIL_RATE_LIMIT_MAX} emails per minute)`);
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "no-reply@jace.ai";

  const res = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text || "",
    html: args.html,
  });

  return { ok: true, id: res.data?.id, error: res.error ?? null };
}
