import crypto from "crypto";

const TAG = "[WEBHOOK-SENDER]";

export interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const maxRetries = 3;
  let lastError: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      console.log(`${TAG} Attempt ${attempt}/${maxRetries} for ${eventType} [${eventKey}] to ${webhookUrl}`);

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

      if (response.ok) {
        const respText = await response.text().catch(() => "");
        console.log(`${TAG} Delivered ${eventType} [${eventKey}] -> ${response.status} ${respText.substring(0, 200)}`);
        return { success: true, statusCode: response.status };
      }

      const text = await response.text().catch(() => "");
      lastError = `HTTP ${response.status}: ${text.substring(0, 200)}`;

      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`${TAG} Attempt ${attempt} failed for ${eventType} [${eventKey}]: ${lastError}, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      console.error(`${TAG} Non-retryable response for ${eventType} [${eventKey}]: ${lastError}`);
      return { success: false, statusCode: response.status, error: lastError };
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err?.message || "Unknown error";

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`${TAG} Attempt ${attempt} failed for ${eventType} [${eventKey}]: ${lastError}, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  console.error(`${TAG} All retries exhausted for ${eventType} [${eventKey}]:`, lastError);
  return {
    success: false,
    error: lastError || "Delivery failed after retries",
  };
}
