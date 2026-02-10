import { Resend } from "resend";
import type { ToolContext } from "./types";

type SendEmailArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

export async function sendEmail(args: SendEmailArgs, _ctx: ToolContext) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY must be set to use sendEmail");

  if (!args?.to || !args?.subject) {
    throw new Error("sendEmail: 'to' and 'subject' are required");
  }

  const resend = new Resend(apiKey);
  const from = args.from || process.env.RESEND_FROM_EMAIL || "no-reply@jace.ai";

  const res = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });

  return { ok: true, id: res.data?.id, error: res.error ?? null };
}
