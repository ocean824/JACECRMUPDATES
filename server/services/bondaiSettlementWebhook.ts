import crypto from "crypto";

export type SettlementWebhookEvent =
  | "settlement.submitted"
  | "settlement.completed"
  | "settlement.cancelled";

export async function sendWebhookToBondAI(
  webhookUrl: string,
  webhookSecret: string,
  event: SettlementWebhookEvent | string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const { type: _t, eventId: _e, completedAt: _c, ...safePayload } = payload as any;
    const body = JSON.stringify({
      eventId: `settlement-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      type: event,
      completedAt: new Date().toISOString(),
      ...safePayload,
    });

    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body, "utf8")
      .digest("hex");

    console.log(`[JACE WEBHOOK] Settlement webhook POST ${webhookUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Jace-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const respText = await response.text().catch(() => "");
    console.log(`[JACE WEBHOOK] Settlement webhook response: ${response.status} ${respText}`);

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (err: any) {
    console.error("[JACE WEBHOOK] Failed to send settlement webhook to BondAI:", err?.message);
    return {
      success: false,
      error: err?.message || "Unknown error",
    };
  }
}
