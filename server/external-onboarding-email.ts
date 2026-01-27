import { getUncachableResendClient } from "./email-service";

export async function sendInvestorOnboardingCompletedEmail(params: {
  toEmail: string;
  investorName: string;
  bondaiInvestorId: string;
  jaceInvestorId: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const subject = "JACE Onboarding Complete — You're Cleared to Go Live";
    const safeName = params.investorName || "Investor";

    await client.emails.send({
      from: fromEmail || "JACE <noreply@resend.dev>",
      to: params.toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; line-height: 1.5;">
          <h2 style="color:#0f172a;">Onboarding Complete</h2>
          <p>Hi ${safeName},</p>
          <p>Your JACE investor onboarding has been received and processed.</p>
          <div style="background:#f1f5f9; padding:14px; border-radius:10px; margin:16px 0;">
            <p style="margin:0;"><strong>Status:</strong> Cleared to go live</p>
            <p style="margin:0;"><strong>JACE Investor ID:</strong> ${params.jaceInvestorId}</p>
            <p style="margin:0;"><strong>BondAI Investor ID:</strong> ${params.bondaiInvestorId}</p>
          </div>
          <p>You may now return to BondAI and begin live bidding (if your account permissions allow it).</p>
          <p style="color:#64748b; font-size: 12px; margin-top: 18px;">
            If you did not initiate this onboarding, please reply to this email immediately.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.warn("Investor onboarding completion email not sent (Resend not configured or error):", err);
  }
}
