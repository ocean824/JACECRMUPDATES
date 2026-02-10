/**
 * Process-wide OpenAI concurrency limiter.
 *
 * Why:
 * - /api/agent/run-many limits *agent tasks* in-flight, but each task can make multiple
 *   OpenAI calls (tool loop). This semaphore ensures a hard cap on *OpenAI requests*
 *   in-flight across the whole Node process.
 *
 * Default is intentionally conservative for Replit + shared OpenAI quotas.
 * Tune via OPENAI_GLOBAL_CONCURRENCY.
 */

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly max: number;

  constructor(max: number) {
    this.max = Math.max(1, Math.floor(max));
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }

    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    return () => this.release();
  }

  private release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Global (singleton) semaphore instance.
 *
 * OPENAI_GLOBAL_CONCURRENCY:
 *   - default: 12
 *   - allowed: 1..256
 */
const OPENAI_GLOBAL_CONCURRENCY = clampInt(
  process.env.OPENAI_GLOBAL_CONCURRENCY,
  12,
  1,
  256,
);

const globalSemaphore = new Semaphore(OPENAI_GLOBAL_CONCURRENCY);

/**
 * Run an OpenAI request under the global semaphore.
 *
 * This caps the number of in-flight OpenAI HTTP requests across the whole server.
 */
export async function withOpenAISemaphore<T>(op: () => Promise<T>): Promise<T> {
  const release = await globalSemaphore.acquire();
  try {
    return await op();
  } finally {
    release();
  }
}
