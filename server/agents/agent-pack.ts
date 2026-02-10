import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { AgentSpec, ToolName } from "./types";

// Optional YAML support (only if dependency is installed).
let yaml: any = null;
try {
  const require = createRequire(import.meta.url);
  yaml = require("js-yaml");
} catch {
  yaml = null;
}

export type AgentPack = {
  version: string;
  generatedAt?: string;
  agents: AgentSpec[];
};

const DEFAULT_PACK_PATH = path.join(process.cwd(), "server", "agent-pack", "agent-pack.json");

function ensureToolNames(tools: any): ToolName[] {
  const allowed = new Set(["dbRead", "dbWrite", "sendEmail", "webSearch", "webFetch"]);
  const arr = Array.isArray(tools) ? tools : [];
  return arr.filter((t) => typeof t === "string" && allowed.has(t)) as ToolName[];
}

function normalizeAgent(a: any): AgentSpec {
  if (!a?.id || typeof a.id !== "string") throw new Error("agent-pack: agent.id must be a string");
  return {
    id: a.id,
    displayName: String(a.displayName ?? a.id),
    systemPrompt: String(a.systemPrompt ?? ""),
    allowedTools: ensureToolNames(a.allowedTools),
    outputMode: a.outputMode === "json" ? "json" : "text",
  };
}

function parsePack(raw: string, ext: string): AgentPack {
  const data =
    ext === ".yaml" || ext === ".yml"
      ? (yaml ? yaml.load(raw) : (() => { throw new Error("agent-pack: YAML requires js-yaml dependency"); })())
      : JSON.parse(raw);

  if (!data || typeof data !== "object") throw new Error("agent-pack: invalid file contents");
  const version = String((data as any).version ?? "1.0");
  const agentsRaw = (data as any).agents;
  if (!Array.isArray(agentsRaw)) throw new Error("agent-pack: agents[] is required");
  return {
    version,
    generatedAt: (data as any).generatedAt ? String((data as any).generatedAt) : undefined,
    agents: agentsRaw.map(normalizeAgent),
  };
}

export type LoadedRegistry = {
  packPath: string;
  packMtimeMs: number;
  pack: AgentPack;
  byId: Record<string, AgentSpec>;
};

export function loadAgentPack(packPath?: string): LoadedRegistry {
  const resolved = packPath
    ? path.isAbsolute(packPath)
      ? packPath
      : path.join(process.cwd(), packPath)
    : DEFAULT_PACK_PATH;

  if (!fs.existsSync(resolved)) {
    throw new Error(`agent-pack: file not found at ${resolved}`);
  }

  const st = fs.statSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const raw = fs.readFileSync(resolved, "utf8");
  const pack = parsePack(raw, ext);

  const byId: Record<string, AgentSpec> = {};
  for (const a of pack.agents) {
    byId[a.id] = a;
  }

  return {
    packPath: resolved,
    packMtimeMs: st.mtimeMs,
    pack,
    byId,
  };
}
