import crypto from "crypto";

export type SettlementWebhookEvent =
  | "settlement.submitted"
  | "settlement.completed"
  | "settlement.cancelled";

function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export async function sendWebhookToBondAI(
  webhookUrl: string,
  webhookSecret: string,
  event: SettlementWebhookEvent | string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      payload,
    });

    const timestamp = Date.now().toString();
    const signaturePayload = `${timestamp}.${body}`;
    const signature = hmacSha256Hex(webhookSecret, signaturePayload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp,
      },
      body,
    });

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (err: any) {
    console.error("Failed to send settlement webhook to BondAI:", err);
    return {
      success: false,
      error: err?.message || "Unknown error",
    };
  }
}
