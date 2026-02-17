import crypto from "crypto";

export type SettlementWebhookEvent =
  | "trade.settled"
  | "settlement.failed"
  | "settlement.cancelled";

interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export async function sendBondAISettlementWebhook(
  eventType: SettlementWebhookEvent,
  tradeId: number,
  sessionId: string,
  additionalData: Record<string, unknown> = {}
): Promise<WebhookResult> {
  const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("[JACE WEBHOOK] BONDAI_WEBHOOK_URL not configured, skipping webhook");
    return { success: false, error: "BONDAI_WEBHOOK_URL not configured" };
  }
  const secret = process.env.JACE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[JACE WEBHOOK] JACE_WEBHOOK_SECRET not configured, skipping webhook");
    return { success: false, error: "JACE_WEBHOOK_SECRET not configured" };
  }

  const payload = {
    eventId: `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
    eventType,
    correlationId: `trade-${tradeId}`,
    data: {
      tradeId: Number(tradeId),
      sessionId,
      ...additionalData,
    },
  };

  const body = JSON.stringify(payload);

  const signature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  try {
    console.log(`[JACE WEBHOOK] Sending ${eventType} for trade ${tradeId} to ${webhookUrl}`);

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
    console.log(`[JACE WEBHOOK] Response: ${response.status} ${respText.substring(0, 200)}`);

    return { success: response.ok, statusCode: response.status };
  } catch (err: any) {
    console.error(`[JACE WEBHOOK] Failed to send ${eventType}:`, err?.message);
    return { success: false, error: err?.message || "Unknown error" };
  }
}
