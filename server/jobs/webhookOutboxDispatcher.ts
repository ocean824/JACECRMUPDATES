import { eq, and, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { webhookOutbox } from "@shared/schema";
import { sendWebhookPayload } from "../services/bondaiWebhook";

const TAG = "[OUTBOX-DISPATCHER]";
const POLL_INTERVAL_MS = 15_000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

function backoffMs(attempt: number): number {
  return Math.min(60_000 * Math.pow(2, attempt), 3_600_000);
}

async function claimRows(): Promise<Array<typeof webhookOutbox.$inferSelect>> {
  const rows = await db.execute(sql`
    UPDATE webhook_outbox
    SET status = 'SENDING', updated_at = now()
    WHERE id IN (
      SELECT id FROM webhook_outbox
      WHERE status = 'PENDING' AND next_attempt_at <= now()
      ORDER BY created_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return rows.rows as any[];
}

async function processBatch(): Promise<number> {
  const rows = await claimRows();
  if (rows.length === 0) return 0;

  let processed = 0;
  for (const row of rows) {
    try {
      const result = await sendWebhookPayload(
        row.payloadJson,
        row.eventType,
        row.eventKey
      );

      const newAttemptCount = (row.attemptCount ?? 0) + 1;

      if (result.success) {
        await db
          .update(webhookOutbox)
          .set({
            status: "SENT",
            attemptCount: newAttemptCount,
            lastStatusCode: result.statusCode ?? null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(webhookOutbox.id, row.id));

        console.log(`${TAG} SENT ${row.eventType} [${row.eventKey}]`);
      } else if (newAttemptCount >= MAX_ATTEMPTS) {
        await db
          .update(webhookOutbox)
          .set({
            status: "DEAD",
            attemptCount: newAttemptCount,
            lastStatusCode: result.statusCode ?? null,
            lastError: result.error || "Max attempts reached",
            updatedAt: new Date(),
          })
          .where(eq(webhookOutbox.id, row.id));

        console.error(`${TAG} DEAD ${row.eventType} [${row.eventKey}] after ${newAttemptCount} attempts`);
      } else {
        const nextRetry = new Date(Date.now() + backoffMs(newAttemptCount));
        await db
          .update(webhookOutbox)
          .set({
            status: "PENDING",
            attemptCount: newAttemptCount,
            lastStatusCode: result.statusCode ?? null,
            lastError: result.error || "Delivery failed",
            nextAttemptAt: nextRetry,
            updatedAt: new Date(),
          })
          .where(eq(webhookOutbox.id, row.id));

        console.warn(
          `${TAG} RETRY ${row.eventType} [${row.eventKey}] attempt=${newAttemptCount}, next=${nextRetry.toISOString()}`
        );
      }
      processed++;
    } catch (err: any) {
      await db
        .update(webhookOutbox)
        .set({ status: "PENDING", updatedAt: new Date() })
        .where(eq(webhookOutbox.id, row.id));
      console.error(`${TAG} Error processing outbox row ${row.id}:`, err?.message);
    }
  }

  return processed;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startOutboxDispatcher(): void {
  if (timer) return;
  console.log(`${TAG} Starting outbox dispatcher (poll every ${POLL_INTERVAL_MS}ms)`);

  const tick = async () => {
    try {
      const count = await processBatch();
      if (count > 0) {
        console.log(`${TAG} Processed ${count} outbox entries`);
      }
    } catch (err: any) {
      console.error(`${TAG} Poll error:`, err?.message);
    }
  };

  tick();
  timer = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopOutboxDispatcher(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log(`${TAG} Stopped outbox dispatcher`);
  }
}
