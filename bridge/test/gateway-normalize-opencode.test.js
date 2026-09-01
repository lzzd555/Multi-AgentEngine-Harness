// bridge/test/gateway-normalize-opencode.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeOpenCodeMessages } from "../src/gateway/engines/normalize-opencode.js"
import { isValidNormalizedMessage } from "../src/gateway/message-normalizer.js"

const openCodeTurn = [
  { id: "msg_001", role: "user", content: "打开Outlook", created_at: "2026-08-21T10:00:00Z" },
  {
    id: "msg_002",
    role: "assistant",
    content: "好的，正在打开",
    created_at: "2026-08-21T10:00:05Z",
    tool_calls: [{ id: "call_001", name: "launch", arguments: { app: "outlook" } }],
    info: { role: "assistant", finish: "tool-calls" },
    parts: [
      { type: "text", content: "好的，正在打开" },
      { type: "tool", tool: "launch", state: { status: "completed", title: "启动完成" } },
      { type: "step-finish" }
    ]
  },
  { id: "msg_003", role: "tool", tool_call_id: "call_001", tool_name: "launch", content: "exit 0" }
]

test("opencode messages pass through with validation", () => {
  const normalized = normalizeOpenCodeMessages(openCodeTurn)
  assert.equal(normalized.length, 3)
  assert.equal(isValidNormalizedMessage(normalized[0]), true)
  assert.equal(isValidNormalizedMessage(normalized[1]), true)
  assert.equal(isValidNormalizedMessage(normalized[2]), true)
  assert.equal(normalized[1].info.finish, "tool-calls")
  assert.deepEqual(normalized[1].parts.at(-1), { type: "step-finish" })
})

test("unknown part types and malformed entries are dropped", () => {
  const normalized = normalizeOpenCodeMessages([
    { id: "a", role: "assistant", content: "hi", created_at: "2026-08-21T10:00:00Z", parts: [
      { type: "text", content: "hi" },
      { type: "snapshot" },
      { type: "step-finish" }
    ] },
    null,
    { role: "user" }
  ])
  assert.equal(normalized.length, 1)
  assert.deepEqual(normalized[0].parts, [{ type: "text", content: "hi" }, { type: "step-finish" }])
})

test("missing created_at gets a fallback timestamp", () => {
  const [normalized] = normalizeOpenCodeMessages([{ id: "a", role: "user", content: "q" }])
  assert.match(normalized.created_at, /^\d{4}-\d{2}-\d{2}T/)
})
