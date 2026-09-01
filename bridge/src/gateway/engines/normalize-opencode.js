// bridge/src/gateway/engines/normalize-opencode.js
import { normalizePart } from "../message-normalizer.js"

function fallbackTimestamp() {
  return new Date().toISOString()
}

function normalizeOne(message) {
  if (!message || typeof message !== "object" || typeof message.id !== "string") return undefined
  if (!["user", "assistant", "tool"].includes(message.role)) return undefined
  const normalized = {
    id: message.id,
    role: message.role,
    content: typeof message.content === "string" ? message.content : "",
    created_at: typeof message.created_at === "string" ? message.created_at : fallbackTimestamp()
  }
  if (message.role === "assistant") {
    normalized.tool_calls = Array.isArray(message.tool_calls) ? message.tool_calls : []
    normalized.info = {
      role: "assistant",
      finish: message.info?.finish === "tool-calls" ? "tool-calls" : "stop"
    }
    normalized.parts = (Array.isArray(message.parts) ? message.parts : [])
      .map(normalizePart)
      .filter(Boolean)
  }
  if (message.role === "tool") {
    normalized.tool_call_id = typeof message.tool_call_id === "string" ? message.tool_call_id : ""
    normalized.tool_name = typeof message.tool_name === "string" ? message.tool_name : ""
  }
  return normalized
}

/** OpenCode's native message list is the spec's blueprint: validate, default, pass through. */
export function normalizeOpenCodeMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages.map(normalizeOne).filter(Boolean)
}
