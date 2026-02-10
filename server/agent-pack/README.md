# Agent Pack

This folder defines the runtime **agent registry**.

## Default pack

- `agent-pack.json` is loaded automatically at boot.

You can override the path with:

- `AGENT_PACK_PATH=server/agent-pack/agent-pack.yaml` (or any path)

## Schema (minimal)

```json
{
  "version": "1.0",
  "generatedAt": "2026-02-10T00:00:00Z",
  "agents": [
    {
      "id": "AGENT_00",
      "displayName": "SYSTEMS_ORCHESTRATOR (Executive Orchestrator)",
      "outputMode": "text",
      "allowedTools": ["dbRead", "webSearch", "webFetch"],
      "systemPrompt": "..."
    }
  ]
}
```

### allowedTools

Only these tool names are currently supported:

- `dbRead`
- `dbWrite`
- `sendEmail`
- `webSearch`
- `webFetch`

Anything else is ignored by the loader.

## Reloading

- Set `AGENT_PACK_HOT_RELOAD=true` to auto-reload when the file changes.
- Or call `POST /api/agent/reload`.
