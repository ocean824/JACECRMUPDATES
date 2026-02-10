import { EventEmitter } from "node:events";

export type OpenAI429Event = {
  /** Unix ms */
  ts: number;
  /** 1-based attempt number inside p-retry */
  attemptNumber?: number;
  /** Remaining retries inside p-retry */
  retriesLeft?: number;
  /** Parsed Retry-After / reset hint (ms), if any */
  retryAfterMs?: number | null;
  /** HTTP status if available */
  status?: number;
  /** Error message (best-effort) */
  message?: string;
};

type Events = {
  openai_429: (evt: OpenAI429Event) => void;
};

/**
 * Process-wide monitor for OpenAI rate-limit signals.
 *
 * This lets /run-many implement adaptive concurrency without needing to plumb
 * callbacks through every call site.
 */
class RateLimitMonitor extends EventEmitter {
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.off(event, listener);
  }
}

export const rateLimitMonitor = new RateLimitMonitor();

export function recordOpenAI429(evt: OpenAI429Event) {
  rateLimitMonitor.emit("openai_429", evt);
}
