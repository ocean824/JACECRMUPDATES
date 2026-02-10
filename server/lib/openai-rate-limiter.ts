/**
 * Process-wide OpenAI throughput limiter (Token Bucket).
 *
 * Why:
 * - Semaphore limits *concurrency* (in-flight requests).
 * - Token bucket limits *throughput* (requests/min and tokens/min).
 *
 * This is the most stable combination for large batch runs where each agent
 * may perform multiple tool-loop rounds.
 *
 * Environment variables (all optional):
 * - OPENAI_RPM_LIMIT: Requests-per-minute budget (0 = disabled)
 * - OPENAI_TPM_LIMIT: Tokens-per-minute budget (0 = disabled)
 * - OPENAI_RPM_BURST: Allow short bursts over steady-state (default 1.0)
 * - OPENAI_TPM_BURST: Allow short bursts over steady-state (default 1.0)
 *
 * Token estimation knobs (best-effort; used only for TPM limiter):
 * - OPENAI_TOKEN_ESTIMATE_CHARS_PER_TOKEN (default 4)
 * - OPENAI_TOKEN_ESTIMATE_MESSAGE_OVERHEAD (default 4)
 * - OPENAI_TOKEN_ESTIMATE_DEFAULT_MAX_OUTPUT (default 512)
 * - OPENAI_TOKEN_ESTIMATE_MULTIPLIER (default 1.0)
 */

export type OpenAIRateLimitCost = {
  requests: number;
  tokens: number;
  /** internal: token estimate used (for post-call true-up) */
  _estimatedTokens?: number;
};

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function clampNum(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

class Mutex {
  private chain: Promise<void> = Promise.resolve();

  async run<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = this.chain;
    this.chain = next;
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;
  private capacity: number;
  private refillPerMs: number;

  constructor(limitPerMinute: number, burstMultiplier = 1.0) {
    const limit = Math.max(0, limitPerMinute);
    const burst = Math.max(1.0, burstMultiplier);
    this.capacity = limit * burst;
    this.refillPerMs = limit / 60_000;
    this.tokens = this.capacity;
    this.lastRefillAt = Date.now();
  }

  updateConfig(limitPerMinute: number, burstMultiplier = 1.0) {
    const limit = Math.max(0, limitPerMinute);
    const burst = Math.max(1.0, burstMultiplier);

    // Recompute capacity/refill while preserving current fill ratio.
    const ratio = this.capacity > 0 ? this.tokens / this.capacity : 1;
    this.capacity = limit * burst;
    this.refillPerMs = limit / 60_000;
    this.tokens = this.capacity * ratio;
    this.lastRefillAt = Date.now();
  }

  private refill(now: number) {
    if (this.refillPerMs <= 0 || this.capacity <= 0) {
      this.tokens = this.capacity;
      this.lastRefillAt = now;
      return;
    }
    const elapsed = now - this.lastRefillAt;
    if (elapsed <= 0) return;
    const add = elapsed * this.refillPerMs;
    this.tokens = Math.min(this.capacity, this.tokens + add);
    this.lastRefillAt = now;
  }

  /** Returns wait time in ms until `cost` tokens are available. */
  waitMs(cost: number, now: number): number {
    this.refill(now);
    if (this.capacity <= 0 || this.refillPerMs <= 0) return 0; // disabled
    if (cost <= 0) return 0;
    if (this.tokens >= cost) return 0;
    const missing = cost - this.tokens;
    return Math.ceil(missing / this.refillPerMs);
  }

  consume(cost: number, now: number) {
    this.refill(now);
    if (this.capacity <= 0 || this.refillPerMs <= 0) return; // disabled
    if (cost <= 0) return;
    this.tokens = Math.max(0, this.tokens - cost);
  }

  adjust(delta: number) {
    if (this.capacity <= 0) return;
    this.tokens = Math.min(this.capacity, Math.max(0, this.tokens + delta));
  }
}

type Config = {
  rpm: number;
  tpm: number;
  rpmBurst: number;
  tpmBurst: number;
  charsPerToken: number;
  messageOverhead: number;
  defaultMaxOutput: number;
  tokenMultiplier: number;
};

function loadConfig(): Config {
  return {
    rpm: clampInt(process.env.OPENAI_RPM_LIMIT, 0, 0, 10_000_000),
    tpm: clampInt(process.env.OPENAI_TPM_LIMIT, 0, 0, 10_000_000_000),
    rpmBurst: clampNum(process.env.OPENAI_RPM_BURST, 1.0, 1.0, 10.0),
    tpmBurst: clampNum(process.env.OPENAI_TPM_BURST, 1.0, 1.0, 10.0),
    charsPerToken: clampInt(process.env.OPENAI_TOKEN_ESTIMATE_CHARS_PER_TOKEN, 4, 1, 50),
    messageOverhead: clampInt(process.env.OPENAI_TOKEN_ESTIMATE_MESSAGE_OVERHEAD, 4, 0, 50),
    defaultMaxOutput: clampInt(process.env.OPENAI_TOKEN_ESTIMATE_DEFAULT_MAX_OUTPUT, 512, 0, 1_000_000),
    tokenMultiplier: clampNum(process.env.OPENAI_TOKEN_ESTIMATE_MULTIPLIER, 1.0, 0.5, 5.0),
  };
}

class OpenAIRateLimiter {
  private cfg: Config;
  private reqBucket: TokenBucket;
  private tokBucket: TokenBucket;
  private mutex = new Mutex();
  private lastCfgReadAt = 0;

  constructor() {
    this.cfg = loadConfig();
    this.reqBucket = new TokenBucket(this.cfg.rpm, this.cfg.rpmBurst);
    this.tokBucket = new TokenBucket(this.cfg.tpm, this.cfg.tpmBurst);
  }

  /** Re-read env config occasionally (cheap dynamic tuning in Replit Secrets). */
  private maybeRefreshConfig(now: number) {
    // Only refresh at most once per second.
    if (now - this.lastCfgReadAt < 1000) return;
    this.lastCfgReadAt = now;

    const next = loadConfig();
    const changedRPM = next.rpm !== this.cfg.rpm || next.rpmBurst !== this.cfg.rpmBurst;
    const changedTPM = next.tpm !== this.cfg.tpm || next.tpmBurst !== this.cfg.tpmBurst;
    this.cfg = next;

    if (changedRPM) this.reqBucket.updateConfig(next.rpm, next.rpmBurst);
    if (changedTPM) this.tokBucket.updateConfig(next.tpm, next.tpmBurst);
  }

  isEnabled() {
    return this.cfg.rpm > 0 || this.cfg.tpm > 0;
  }

  getConfig() {
    return this.cfg;
  }

  /**
   * Wait until enough throughput budget exists, then consume it.
   * NOTE: this does not throw—callers just await.
   */
  async consume(cost: OpenAIRateLimitCost): Promise<void> {
    if (!this.isEnabled()) return;

    // Ensure minimum non-negative costs.
    const reqCost = Math.max(0, Math.floor(cost.requests || 0));
    const tokCost = Math.max(0, Math.floor(cost.tokens || 0));

    while (true) {
      const waitMs = await this.mutex.run(async () => {
        const now = Date.now();
        this.maybeRefreshConfig(now);

        const wReq = this.cfg.rpm > 0 ? this.reqBucket.waitMs(reqCost, now) : 0;
        const wTok = this.cfg.tpm > 0 ? this.tokBucket.waitMs(tokCost, now) : 0;
        const w = Math.max(wReq, wTok);

        if (w <= 0) {
          if (this.cfg.rpm > 0) this.reqBucket.consume(reqCost, now);
          if (this.cfg.tpm > 0) this.tokBucket.consume(tokCost, now);
          return 0;
        }

        // Small jitter to avoid stampedes.
        const jitter = Math.floor(Math.random() * 50);
        return Math.min(w + jitter, 60_000);
      });

      if (waitMs <= 0) return;
      await sleep(waitMs);
    }
  }

  /** Post-call adjustment (best-effort true-up against OpenAI usage). */
  async trueUpTokens(estimatedTokens: number, actualTokens: number) {
    if (!this.isEnabled()) return;
    if (!(this.cfg.tpm > 0)) return;

    const est = Math.max(0, Math.floor(estimatedTokens || 0));
    const act = Math.max(0, Math.floor(actualTokens || 0));
    const delta = est - act; // positive means refund, negative means consume extra

    if (delta === 0) return;

    await this.mutex.run(async () => {
      this.tokBucket.adjust(delta);
    });
  }
}

// Singleton
const limiter = new OpenAIRateLimiter();

function stringifyContent(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
      .join(" ");
  }
  if (typeof content === "object") return JSON.stringify(content);
  return String(content);
}

function estimatePromptChars(messages: any[] | undefined): number {
  if (!Array.isArray(messages)) return 0;
  let chars = 0;
  for (const m of messages) {
    if (!m) continue;
    chars += String(m.role ?? "").length;
    if (m.name) chars += String(m.name).length;
    chars += stringifyContent(m.content).length;
  }
  return chars;
}

function getMaxOutputTokens(params: any, cfg: Config): number {
  const v =
    params?.max_tokens ??
    params?.max_completion_tokens ??
    params?.max_output_tokens ??
    process.env.OPENAI_MAX_OUTPUT_TOKENS;

  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  return cfg.defaultMaxOutput;
}

function estimateTokenCostFromChatCreateArgs(args: any[], cfg: Config): number {
  const params = args?.[0] ?? {};

  // Prompt estimate
  const promptChars = estimatePromptChars(params?.messages);
  const promptTokens = Math.ceil(promptChars / cfg.charsPerToken);
  const messageOverhead = Array.isArray(params?.messages)
    ? params.messages.length * cfg.messageOverhead
    : 0;

  // Completion estimate
  const completionTokens = getMaxOutputTokens(params, cfg);

  const total = (promptTokens + messageOverhead + completionTokens) * cfg.tokenMultiplier;
  return Math.max(0, Math.ceil(total));
}

/**
 * Wrap an OpenAI call with token-bucket throughput control.
 *
 * This wrapper is generic: it takes the args being passed to
 * openai.chat.completions.create(...) so it can estimate tokens.
 */
export async function withOpenAIRateLimit<T>(
  createArgs: any[],
  op: () => Promise<T>,
): Promise<T> {
  if (!limiter.isEnabled()) return op();

  const cfg = limiter.getConfig();
  const estTokens = cfg.tpm > 0 ? estimateTokenCostFromChatCreateArgs(createArgs, cfg) : 0;

  const cost: OpenAIRateLimitCost = {
    requests: cfg.rpm > 0 ? 1 : 0,
    tokens: estTokens,
    _estimatedTokens: estTokens,
  };

  await limiter.consume(cost);

  const res = await op();

  // Best-effort true-up using response usage (if present).
  const usage = (res as any)?.usage;
  const actualTotalTokens = usage?.total_tokens;
  if (typeof actualTotalTokens === "number" && Number.isFinite(actualTotalTokens)) {
    await limiter.trueUpTokens(estTokens, actualTotalTokens);
  }

  return res;
}
