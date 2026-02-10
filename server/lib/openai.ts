import OpenAI from "openai";
import { withOpenAISemaphore } from "./openai-semaphore";
import { withOpenAIRateLimit } from "./openai-rate-limiter";

let _openai: OpenAI | null = null;

function getOrCreateClient(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY must be set");
  }

  _openai = new OpenAI({
    apiKey,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  });

  try {
    const originalCreate = _openai.chat.completions.create.bind(_openai.chat.completions);
    (_openai.chat.completions as any).create = (...args: [any, ...any[]]) =>
      withOpenAIRateLimit(args, () => withOpenAISemaphore(() => (originalCreate as any)(...args)));
  } catch {
    // If OpenAI SDK shape changes, we fail open (no semaphore) rather than crash.
  }

  return _openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getOrCreateClient();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export const DEFAULT_MODEL =
  process.env.AI_INTEGRATIONS_MODEL || process.env.OPENAI_MODEL || "gpt-4.1";
