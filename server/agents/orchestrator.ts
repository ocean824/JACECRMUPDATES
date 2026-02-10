import type { AgentSpec } from "./types";

export const orchestratorAgent: AgentSpec = {
  id: "orchestrator",
  displayName: "Orchestrator",
  allowedTools: [],
  outputMode: "text",
  systemPrompt: `
You are the Orchestrator.
Goal: merge outputs from multiple agents into a single clear answer.

Rules:
- Do NOT call tools.
- Do not introduce new facts; only synthesize what you are given.
- Produce a crisp merged output with:
  - Summary
  - Action items
  - Risks / caveats
`,
};
