import type { Express, Request, Response } from "express";
import { getAgent, listAgents, reloadAgentRegistry, getAgentPackMeta } from "../agents";
import type { AgentId, ToolName } from "../agents/types";
import { assertToolAllowed, buildOpenAITools, runTool } from "../tools";
import { DEFAULT_MODEL, openai } from "../lib/openai";
import { withOpenAIRetry } from "../lib/openai-retry";
import { hashPrompt, logAgentRun } from "../lib/agent-logger";
import { runMany } from "../orchestrator/runMany";

type RunBody = {
  agent_id: AgentId;
  input: string;
  session_id?: string;
  context?: any;
};

export function registerAgentRoutes(app: Express, isAuthenticated: any) {
  app.get("/api/agent/list", isAuthenticated, async (_req: Request, res: Response) => {
    res.json({ ok: true, meta: getAgentPackMeta(), agents: listAgents() });
  });

  // Hot reload (useful after editing agent-pack.json in Replit)
  app.post("/api/agent/reload", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      return res.json(reloadAgentRegistry());
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: e?.message ?? "Failed to reload agent-pack" });
    }
  });

  app.post("/api/agent/run", isAuthenticated, async (req: any, res: Response) => {
    const startedAt = Date.now();
    const body = (req.body || {}) as RunBody;

    try {
      if (!body.agent_id || !body.input) {
        return res.status(400).json({ ok: false, error: "agent_id and input are required" });
      }

      const { result } = await runAgentWithTools({
        agent_id: body.agent_id,
        input: body.input,
        context: body.context,
        session_id: body.session_id,
        user_id: req.user?.id != null ? Number(req.user.id) : undefined,
      });

      return res.json({ ok: true, agent_id: body.agent_id, result, ms: Date.now() - startedAt });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err?.message ?? "Unknown error" });
    }
  });

  app.post("/api/agent/run-many", isAuthenticated, async (req: any, res: Response) => {
    const startedAt = Date.now();
    try {
      const maxTasks = clampInt(process.env.AGENT_MAX_TASKS, 200, 1, 2000);
      // Default allows full-pack parallelization (e.g., 118+), but you can lower it via AGENT_MAX_CONCURRENCY.
      const maxConcurrency = clampInt(process.env.AGENT_MAX_CONCURRENCY, 128, 1, 128);

      const runAll = Boolean(req.body?.run_all);
      const tasks = runAll
        ? listAgents().map((a) => ({
            agent_id: a.id,
            input: String(req.body?.input ?? ""),
            context: req.body?.context,
            session_id: req.body?.session_id,
          }))
        : (Array.isArray(req.body?.tasks) ? req.body.tasks : []);

      if (!tasks.length) return res.status(400).json({ ok: false, error: "tasks[] is required" });
      if (runAll && !String(req.body?.input ?? "").trim()) {
        return res.status(400).json({ ok: false, error: "input is required when run_all=true" });
      }
      if (tasks.length > maxTasks) {
        return res
          .status(400)
          .json({ ok: false, error: `Too many tasks (max ${maxTasks}).` });
      }

      const requestedConcurrency = Number(req.body?.concurrency ?? 3);
      const concurrency = Math.min(Math.max(requestedConcurrency, 1), maxConcurrency);

      const results = await runMany(
        tasks,
        async (t) => {
          const out = await runAgentWithTools({
            agent_id: t.agent_id,
            input: t.input,
            context: t.context,
            session_id: t.session_id,
            user_id: req.user?.id != null ? Number(req.user.id) : undefined,
          });
          return out.result;
        },
        concurrency,
      );

      return res.json({ ok: true, ms: Date.now() - startedAt, results });
    } catch (err: any) {
      return res.status(400).json({ ok: false, error: err?.message ?? "Unknown error" });
    }
  });
}

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

async function runAgentWithTools(opts: {
  agent_id: AgentId;
  input: string;
  context?: any;
  session_id?: string;
  user_id?: number;
}) {
  const startedAt = Date.now();
  const agent = getAgent(opts.agent_id);
  const toolSchemas = buildOpenAITools(agent.allowedTools);
  const toolCallLogs: any[] = [];

  const system = agent.systemPrompt;
  const promptHash = hashPrompt(system + "\n\n" + opts.input);

  const messages: any[] = [
    { role: "system", content: system },
    ...(opts.context ? [{ role: "system", content: `Context (JSON):\n${safeJson(opts.context)}` }] : []),
    { role: "user", content: opts.input },
  ];

  const maxRounds = 6;
  let finalText: any = null;

  for (let round = 0; round < maxRounds; round++) {
    const resp = await withOpenAIRetry(() =>
      openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        tools: toolSchemas.length ? toolSchemas : undefined,
        tool_choice: toolSchemas.length ? "auto" : undefined,
        temperature: 0.2,
        max_tokens: 900,
      })
    );

    const msg = resp.choices?.[0]?.message;
    if (!msg) throw new Error("No model message");

    const toolCalls = (msg as any).tool_calls as any[] | undefined;
    if (toolCalls && toolCalls.length) {
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: toolCalls });

      for (const tc of toolCalls) {
        const toolName = tc?.function?.name as ToolName;
        const toolArgs = tc?.function?.arguments ? safeParse(tc.function.arguments) : {};
        assertToolAllowed(agent.allowedTools, toolName);

        const { result, log } = await runTool(
          toolName,
          toolArgs,
          { userId: opts.user_id, sessionId: opts.session_id },
        );
        toolCallLogs.push({ ...log, tool_call_id: tc.id });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: safeJson(result),
        });
      }

      continue;
    }

    finalText = msg.content ?? "";
    break;
  }

  const result = agent.outputMode === "json" ? safeParseJsonOrText(finalText) : finalText;

  await logAgentRun({
    ts: new Date().toISOString(),
    agent_id: opts.agent_id,
    session_id: opts.session_id,
    user_id: opts.user_id,
    input: opts.input,
    prompt_hash: promptHash,
    tool_calls: toolCallLogs,
    output: result,
    ms: Date.now() - startedAt,
  });

  return { result, promptHash, tool_calls: toolCallLogs };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return JSON.stringify({ _raw: String(v) });
  }
}

function safeParseJsonOrText(s: any) {
  if (typeof s !== "string") return s;
  try {
    return JSON.parse(s);
  } catch {
    // try to extract JSON block
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return { _raw: s };
      }
    }
    return { _raw: s };
  }
}
