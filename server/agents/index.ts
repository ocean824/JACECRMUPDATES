import fs from "node:fs";
import type { AgentId, AgentSpec } from "./types";
import { loadAgentPack, type LoadedRegistry } from "./agent-pack";

let registry: LoadedRegistry | null = null;

function getConfiguredPackPath(): string | undefined {
  return process.env.AGENT_PACK_PATH || undefined;
}

function shouldHotReload(): boolean {
  return String(process.env.AGENT_PACK_HOT_RELOAD || "").toLowerCase() === "true";
}

export function initAgentRegistry() {
  registry = loadAgentPack(getConfiguredPackPath());
}

export function reloadAgentRegistry() {
  registry = loadAgentPack(getConfiguredPackPath());
  return { ok: true, packPath: registry.packPath, version: registry.pack.version, agents: Object.keys(registry.byId).length };
}

function maybeHotReload() {
  if (!shouldHotReload()) return;
  if (!registry) {
    initAgentRegistry();
    return;
  }
  try {
    const st = fs.statSync(registry.packPath);
    if (st.mtimeMs !== registry.packMtimeMs) {
      registry = loadAgentPack(registry.packPath);
    }
  } catch {
    // ignore
  }
}

export function getAgent(agentId: AgentId): AgentSpec {
  maybeHotReload();
  if (!registry) initAgentRegistry();
  const agent = registry!.byId[String(agentId)];
  if (!agent) throw new Error(`Unknown agent_id: ${agentId}`);
  return agent;
}

export function listAgents(): AgentSpec[] {
  maybeHotReload();
  if (!registry) initAgentRegistry();
  return Object.values(registry!.byId);
}

export function getAgentPackMeta() {
  if (!registry) initAgentRegistry();
  return {
    packPath: registry!.packPath,
    version: registry!.pack.version,
    generatedAt: registry!.pack.generatedAt,
    agentCount: Object.keys(registry!.byId).length,
  };
}
