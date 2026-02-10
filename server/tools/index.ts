import type { ToolName } from "../agents/types";
import type { ToolContext, ToolCallLog } from "./types";
import { dbRead, dbWrite } from "./db";
import { sendEmail } from "./email";
import { webSearch, webFetch } from "./web";

export type ToolFn = (args: any, ctx: ToolContext) => Promise<any>;

export const tools: Record<ToolName, ToolFn> = {
  dbRead,
  dbWrite,
  sendEmail,
  webSearch,
  webFetch,
};

export function assertToolAllowed(agentAllowed: ToolName[], tool: ToolName) {
  if (!agentAllowed.includes(tool)) {
    throw new Error(`Tool not allowed for this agent: ${tool}`);
  }
}

export function buildOpenAITools(allowed: ToolName[]) {
  // Expose only the allowed tool schemas to the model.
  const schemas: any[] = [];
  if (allowed.includes("dbRead")) {
    schemas.push({
      type: "function",
      function: {
        name: "dbRead",
        description:
          "Read data from the JACE database via a safe allowlisted storage method.",
        parameters: {
          type: "object",
          properties: {
            method: { type: "string", description: "Allowlisted storage read method name." },
            params: { type: "array", items: {}, description: "JSON args array for the method." },
          },
          required: ["method"],
        },
      },
    });
  }
  if (allowed.includes("dbWrite")) {
    schemas.push({
      type: "function",
      function: {
        name: "dbWrite",
        description:
          "Write data to the JACE database via a safe allowlisted storage method.",
        parameters: {
          type: "object",
          properties: {
            method: { type: "string", description: "Allowlisted storage write method name." },
            params: { type: "array", items: {}, description: "JSON args array for the method." },
          },
          required: ["method"],
        },
      },
    });
  }
  if (allowed.includes("sendEmail")) {
    schemas.push({
      type: "function",
      function: {
        name: "sendEmail",
        description: "Send an email via Resend.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string" },
            subject: { type: "string" },
            text: { type: "string" },
            html: { type: "string" },
            from: { type: "string" },
          },
          required: ["to", "subject"],
        },
      },
    });
  }
  if (allowed.includes("webSearch")) {
    schemas.push({
      type: "function",
      function: {
        name: "webSearch",
        description: "Search the public web (best-effort). Returns titles + URLs.",
        parameters: {
          type: "object",
          properties: {
            q: { type: "string" },
            max_results: { type: "number" },
          },
          required: ["q"],
        },
      },
    });
  }
  if (allowed.includes("webFetch")) {
    schemas.push({
      type: "function",
      function: {
        name: "webFetch",
        description: "Fetch a public URL and return page text (truncated).",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string" },
            max_chars: { type: "number" },
          },
          required: ["url"],
        },
      },
    });
  }
  return schemas;
}

export async function runTool(
  name: ToolName,
  args: any,
  ctx: ToolContext,
): Promise<{ result: any; log: ToolCallLog }> {
  const startedAt = Date.now();
  try {
    const result = await tools[name](args, ctx);
    const finishedAt = Date.now();
    return {
      result,
      log: {
        name,
        args,
        startedAt,
        finishedAt,
        ok: true,
        resultPreview: preview(result),
      },
    };
  } catch (err: any) {
    const finishedAt = Date.now();
    return {
      result: { ok: false, error: err?.message ?? "Tool error" },
      log: {
        name,
        args,
        startedAt,
        finishedAt,
        ok: false,
        error: err?.message ?? "Tool error",
      },
    };
  }
}

function preview(v: any) {
  try {
    const s = JSON.stringify(v);
    if (s.length <= 800) return v;
    return { _preview: s.slice(0, 800) + "…" };
  } catch {
    return { _preview: String(v).slice(0, 800) + "…" };
  }
}
