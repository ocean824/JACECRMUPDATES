import type { ToolName } from "../agents/types";

export type ToolCallLog = {
  name: ToolName;
  args: any;
  startedAt: number;
  finishedAt: number;
  ok: boolean;
  error?: string;
  resultPreview?: any;
};

export type ToolContext = {
  userId?: number;
  sessionId?: string;
};
