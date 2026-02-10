import pRetry, { AbortError } from "p-retry";
import { recordOpenAI429 } from "./rate-limit-monitor";

/**
 * OpenAI retry/backoff helper.
 *
 * Purpose: make high-parallel runs (e.g., 100+ concurrent completions) survive transient 429s
 * by applying exponential backoff with jitter, and (when present) honoring Retry-After.
 */

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getStatus(err: any): number | undefined {
  return (
    err?.status ??
    err?.statusCode ??
    err?.response?.status ??
    err?.cause?.status ??
    undefined
  );
}

function normalizeHeaders(h: any): Record<string, string> {
  if (!h) return {};
  // Fetch/undici Headers
  if (typeof h.get === "function") {
    const out: Record<string, string> = {};
    for (const k of [
      "retry-after",
      "x-ratelimit-reset-requests",
      "x-ratelimit-reset-tokens",
    ]) {
      const v = h.get(k);
      if (v) out[k] = String(v);
    }
    return out;
  }
  // Plain object
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === "string") out[k.toLowerCase()] = v;
    else if (Array.isArray(v)) out[k.toLowerCase()] = String(v[0]);
    else if (v != null) out[k.toLowerCase()] = String(v);
  }
  return out;
}

function parseRetryAfterMs(headers: Record<string, string>): number | null {
  const raw = headers["retry-after"];
  if (!raw) return null;

  // Spec: either seconds or HTTP date.
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.floor(seconds * 1000));

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());

  return null;
}

function parseResetHeaderMs(v?: string): number | null {
  if (!v) return null;
  // Common shapes:
  // - "1s" / "250ms" / "2m" / "0.5s"
  // - "12" (seconds)
  const trimmed = v.trim();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) return Math.max(0, Math.floor(asNum * 1000));

  const m = trimmed.match(/^([0-9]*\.?[0-9]+)\s*(ms|s|m|h)$/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value)) return null;
  switch (unit) {
    case "ms":
      return Math.max(0, Math.floor(value));
    case "s":
      return Math.max(0, Math.floor(value * 1000));
    case "m":
      return Math.max(0, Math.floor(value * 60_000));
    case "h":
      return Math.max(0, Math.floor(value * 3_600_000));
    default:
      return null;
  }
}

function isRetryable429(err: any): boolean {
  const status = getStatus(err);
  if (status === 429) return true;

  const msg = (err instanceof Error ? err.message : String(err ?? ""))
    .toLowerCase()
    .trim();
  return msg.includes(" 429") || msg.includes("429") || msg.includes("rate limit");
}

export type OpenAIRetryOptions = {
  /** Number of retries after the initial attempt (default: 8) */
  retries?: number;
  /** Min backoff delay in ms (default: 1000) */
  minTimeout?: number;
  /** Max backoff delay in ms (default: 30000) */
  maxTimeout?: number;
  /** Multiplier for exponential backoff (default: 2) */
  factor?: number;
  /** Add jitter to spread retries (default: true) */
  randomize?: boolean;
};

/**
 * Retry wrapper specifically for OpenAI calls.
 * Retries only on 429/rate-limit signals; other errors abort immediately.
 */
export async function withOpenAIRetry<T>(
  op: () => Promise<T>,
  options: OpenAIRetryOptions = {},
): Promise<T> {
  const retries = clampInt(
    options.retries ?? process.env.OPENAI_RETRY_RETRIES,
    8,
    0,
    25,
  );
  const minTimeout = clampInt(
    options.minTimeout ?? process.env.OPENAI_RETRY_MIN_TIMEOUT_MS,
    1000,
    0,
    120_000,
  );
  const maxTimeout = clampInt(
    options.maxTimeout ?? process.env.OPENAI_RETRY_MAX_TIMEOUT_MS,
    30_000,
    100,
    300_000,
  );
  const factor = Number(options.factor ?? process.env.OPENAI_RETRY_FACTOR ?? 2);
  const randomize =
    options.randomize ??
    (process.env.OPENAI_RETRY_RANDOMIZE
      ? process.env.OPENAI_RETRY_RANDOMIZE !== "false"
      : true);

  return pRetry(
    async () => {
      try {
        return await op();
      } catch (err: any) {
        if (isRetryable429(err)) throw err; // retry
        // Any non-429 error should fail fast (don’t mask programming / prompt bugs).
        throw new AbortError(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    },
    {
      retries,
      minTimeout,
      maxTimeout,
      factor,
      randomize,
      onFailedAttempt: async (err) => {
        // p-retry only reaches onFailedAttempt for errors we allow to retry.
        // In our wrapper that means 429/rate-limit signals.
        // If the API tells us exactly when to retry, honor it (up to a sane cap).
        const anyErr: any = err;
        const headers = normalizeHeaders(anyErr?.headers ?? anyErr?.response?.headers);
        const retryAfter = parseRetryAfterMs(headers);
        const resetHint =
          parseResetHeaderMs(headers["x-ratelimit-reset-requests"]) ??
          parseResetHeaderMs(headers["x-ratelimit-reset-tokens"]);

        const extra = retryAfter ?? resetHint;

        // Emit an event so batch runners can adaptively reduce concurrency.
        recordOpenAI429({
          ts: Date.now(),
          attemptNumber: (anyErr as any)?.attemptNumber,
          retriesLeft: (anyErr as any)?.retriesLeft,
          retryAfterMs: extra ?? null,
          status: getStatus(anyErr),
          message: (anyErr instanceof Error ? anyErr.message : String(anyErr ?? "")) || undefined,
        });

        if (extra && extra > 0) {
          // Cap extra sleep so a single task doesn’t hang forever.
          await sleep(Math.min(extra, 60_000));
        }
      },
    },
  );
}
