import crypto from "crypto";
import pRetry from "p-retry";

const TAG = "[WEBHOOK-SENDER]";

export interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export async function sendWebhookPayload(
  payloadJson: string,
  eventType: string,
  eventKey: string
): Promise<WebhookSendResult> {
  const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(`${TAG} BONDAI_WEBHOOK_URL not configured, skipping`);
    return { success: false, error: "BONDAI_WEBHOOK_URL not configured" };
  }

  const secret = process.env.JACE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn(`${TAG} JACE_WEBHOOK_SECRET not configured, skipping`);
    return { success: false, error: "JACE_WEBHOOK_SECRET not configured" };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadJson)
    .digest("hex");

  const doSend = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      console.log(`${TAG} Attempting ${eventType} [${eventKey}] to ${webhookUrl}`);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Jace-Signature": signature,
          "X-Jace-Timestamp": timestamp,
        },
        body: payloadJson,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok && response.status >= 500) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      }

      return response;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  try {
    const response = await pRetry(doSend, {
      retries: 3,
      minTimeout: 1_000,
      maxTimeout: 8_000,
      factor: 2,
      onFailedAttempt: (err: any) => {
        console.warn(
          `${TAG} Attempt ${err.attemptNumber} failed for ${eventType} [${eventKey}]: ${(err as Error).message}`
        );
      },
    });

    const respText = await response.text().catch(() => "");
    console.log(`${TAG} Delivered ${eventType} [${eventKey}] -> ${response.status} ${respText.substring(0, 200)}`);
    return { success: true, statusCode: response.status };
  } catch (err: any) {
    console.error(`${TAG} All retries exhausted for ${eventType} [${eventKey}]:`, err?.message);
    return {
      success: false,
      statusCode: err?.response?.status,
      error: err?.message || "Delivery failed after retries",
    };
  }
}
