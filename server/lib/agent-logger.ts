import fs from "node:fs/promises";
import crypto from "node:crypto";

export type AgentRunLogEntry = {
  ts: string;
  agent_id: string;
  session_id?: string;
  user_id?: number;
  input: string;
  prompt_hash: string;
  tool_calls: any[];
  output: any;
  ms: number;
};

export function hashPrompt(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export async function logAgentRun(entry: AgentRunLogEntry) {
  const line = JSON.stringify(entry) + "\n";
  await fs.appendFile("./agent_runs.jsonl", line, "utf8");
}
