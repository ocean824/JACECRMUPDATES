/**
 * AgentId is intentionally a string so the runtime registry can be loaded
 * from an external agent-pack JSON/YAML file (no TypeScript edits required
 * when adding/removing agents).
 */
export type AgentId = string;

export type ToolName = "dbRead" | "dbWrite" | "sendEmail" | "webSearch" | "webFetch";

export type AgentSpec = {
  id: AgentId;
  displayName: string;
  systemPrompt: string;
  allowedTools: ToolName[];
  outputMode?: "text" | "json";
};
