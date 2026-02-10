import { getAgent } from "../agents";
import type { AgentId } from "../agents/types";
import { rateLimitMonitor, type OpenAI429Event } from "../lib/rate-limit-monitor";

export type RunManyTask = {
  agent_id: AgentId;
  input: string;
  context?: any;
  session_id?: string;
};

export type RunManyResult<T> = {
  /** Input position; results are returned in input order */
  index: number;
  agent_id: AgentId;
  ok: boolean;
  ms: number;
  result?: T;
  error?: string;
};

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function envBool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null) return fallback;
  return v !== "0" && v.toLowerCase() !== "false";
}

/**
 * Adaptive concurrency gate.
 * - Starts at requested concurrency.
 * - When OpenAI 429s spike, reduces the number of in-flight tasks and applies a short cooldown.
 * - After a stable period (no 429s), slowly ramps concurrency back up.
 */
class AdaptiveGate {
  private active = 0;
  private limit: number;
  private readonly min: number;
  private readonly max: number;
  private cooldownUntil = 0;
  private last429At = 0;
  private spikeCount = 0;
  private readonly waiters: Array<() => void> = [];

  // Tunables
  private readonly spikeWindowMs: number;
  private readonly rampUpAfterMs: number;
  private readonly cooldownBaseMs: number;
  private readonly cooldownMaxMs: number;
  private readonly reduceFactor: number;

  constructor(opts: {
    initial: number;
    min?: number;
    max?: number;
    spikeWindowMs?: number;
    rampUpAfterMs?: number;
    cooldownBaseMs?: number;
    cooldownMaxMs?: number;
    reduceFactor?: number;
  }) {
    this.min = Math.max(1, Math.floor(opts.min ?? 1));
    this.max = Math.max(this.min, Math.floor(opts.max ?? opts.initial));
    this.limit = Math.min(this.max, Math.max(this.min, Math.floor(opts.initial)));

    this.spikeWindowMs = Math.max(250, Math.floor(opts.spikeWindowMs ?? 5000));
    this.rampUpAfterMs = Math.max(1000, Math.floor(opts.rampUpAfterMs ?? 15000));
    this.cooldownBaseMs = Math.max(0, Math.floor(opts.cooldownBaseMs ?? 1000));
    this.cooldownMaxMs = Math.max(this.cooldownBaseMs, Math.floor(opts.cooldownMaxMs ?? 30000));
    this.reduceFactor = Math.min(0.95, Math.max(0.1, Number(opts.reduceFactor ?? 0.7)));
  }

  getLimit() {
    return this.limit;
  }

  private notifyOne() {
    const w = this.waiters.shift();
    if (w) w();
  }

  private notifyAll() {
    while (this.waiters.length) {
      const w = this.waiters.shift();
      if (w) w();
    }
  }

  async acquire() {
    // Wait for a slot (and any cooldown) before starting a new task.
    // Note: we don’t prefetch from the queue until we have a slot.
    while (true) {
      const now = Date.now();
      const waitForCooldown = this.cooldownUntil - now;
      if (waitForCooldown > 0) {
        await sleep(waitForCooldown);
        continue;
      }

      if (this.active < this.limit) {
        this.active++;
        return;
      }

      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
  }

  release() {
    this.active = Math.max(0, this.active - 1);
    this.notifyOne();
  }

  /**
   * Called when we observe a 429. Reduces concurrency and adds a cooldown.
   */
  on429(evt: OpenAI429Event) {
    const now = Date.now();
    if (now - this.last429At <= this.spikeWindowMs) this.spikeCount++;
    else this.spikeCount = 1;
    this.last429At = now;

    // Reduce concurrency. If spikes persist, reduce harder.
    const factor = this.spikeCount >= 3 ? Math.min(this.reduceFactor, 0.5) : this.reduceFactor;
    const nextLimit = Math.max(this.min, Math.floor(this.limit * factor));
    this.limit = Math.max(this.min, Math.min(this.max, nextLimit || this.min));

    // Cooldown: exponential-ish with spike count, plus any server hint.
    const exp = Math.min(6, Math.max(0, this.spikeCount - 1));
    const computed = Math.min(this.cooldownMaxMs, this.cooldownBaseMs * Math.pow(2, exp));
    const hinted = evt.retryAfterMs ? Math.min(this.cooldownMaxMs, evt.retryAfterMs) : 0;
    const cooldown = Math.max(computed, hinted);
    this.cooldownUntil = Math.max(this.cooldownUntil, now + cooldown);

    // Wake blocked acquirers so they can observe the updated cooldown/limit.
    this.notifyAll();
  }

  /**
   * Called after task completion; ramps concurrency up slowly after stability.
   */
  onTaskDone() {
    if (this.limit >= this.max) return;
    const now = Date.now();
    if (this.last429At && now - this.last429At < this.rampUpAfterMs) return;

    // Gentle ramp: +1 at a time.
    this.limit = Math.min(this.max, this.limit + 1);
    this.notifyAll();
  }
}

/**
 * Bounded worker-pool executor.
 * - Validates agent existence per task.
 * - Captures per-task errors (does not fail the whole batch).
 * - Returns results in input order.
 */
export async function runMany<T>(
  tasks: RunManyTask[],
  runOne: (task: RunManyTask) => Promise<T>,
  concurrency = 3,
) {
  const queue = tasks.map((t, index) => ({ ...t, index }));
  const results: Array<RunManyResult<T> | undefined> = new Array(queue.length);

  // Adaptive mode can be disabled if you want fixed concurrency.
  const adaptiveEnabled = envBool("AGENT_ADAPTIVE_CONCURRENCY", true);
  const initialConcurrency = Math.max(1, Math.floor(concurrency || 1));

  const gate = new AdaptiveGate({
    initial: initialConcurrency,
    min: clampInt(process.env.AGENT_ADAPTIVE_MIN_CONCURRENCY, 1, 1, initialConcurrency),
    max: initialConcurrency,
    spikeWindowMs: clampInt(process.env.AGENT_ADAPTIVE_SPIKE_WINDOW_MS, 5000, 250, 60_000),
    rampUpAfterMs: clampInt(process.env.AGENT_ADAPTIVE_RAMP_UP_AFTER_MS, 15_000, 1000, 300_000),
    cooldownBaseMs: clampInt(process.env.AGENT_ADAPTIVE_COOLDOWN_BASE_MS, 1000, 0, 60_000),
    cooldownMaxMs: clampInt(process.env.AGENT_ADAPTIVE_COOLDOWN_MAX_MS, 30_000, 1000, 300_000),
    reduceFactor: Number(process.env.AGENT_ADAPTIVE_REDUCE_FACTOR ?? 0.7),
  });

  const on429 = (evt: OpenAI429Event) => {
    if (!adaptiveEnabled) return;
    gate.on429(evt);
  };
  if (adaptiveEnabled) rateLimitMonitor.on("openai_429", on429);

  async function worker() {
    while (queue.length) {
      // Don’t dequeue until we have a slot.
      await gate.acquire();

      const next = queue.shift();
      if (!next) {
        gate.release();
        return;
      }

      const startedAt = Date.now();
      try {
        // Validate agent exists
        getAgent(next.agent_id);
        const result = await runOne(next);
        results[next.index] = {
          index: next.index,
          agent_id: next.agent_id,
          ok: true,
          ms: Date.now() - startedAt,
          result,
        };
      } catch (err: any) {
        results[next.index] = {
          index: next.index,
          agent_id: next.agent_id,
          ok: false,
          ms: Date.now() - startedAt,
          error: err?.message ?? String(err),
        };
      } finally {
        gate.release();
        if (adaptiveEnabled) gate.onTaskDone();
      }
    }
  }

  const workerCount = initialConcurrency;
  try {
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } finally {
    if (adaptiveEnabled) rateLimitMonitor.off("openai_429", on429);
  }

  return results.filter(Boolean) as RunManyResult<T>[];
}
