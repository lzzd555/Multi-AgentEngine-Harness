// bridge/test/gateway-normalize-acp.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { normalizeAcpMessages, acpStatusToSpec } from "../src/gateway/engines/normalize-acp.js"

const CREATED = Date.UTC(2026, 8, 1, 10, 0, 0)

function assistantMessage(parts, { created = CREATED } = {}) {
  return { info: { id: "msg_2", role: "assistant", sessionID: "s1", time: { created } }, parts }
}

test("a completed turn yields finish=stop with a trailing step-finish", () => {
  const normalized = normalizeAcpMessages([
    { info: { id: "msg_1", role: "user", sessionID: "s1", time: { created: CREATED } }, parts: [{ type: "text", text: "打开Outlook" }] },
    assistantMessage([
      { type: "text", text: "好的" },
      { type: "tool", tool: "launch", callID: "call_001", state: { status: "completed", input: { app: "outlook" }, output: "exit 0", title: "启动完成" } },
      { type: "text", text: "已打开" }
    ])
  ])
  assert.equal(normalized.length, 3) // user + assistant + tool result
  const assistant = normalized[1]
  assert.equal(assistant.info.finish, "stop")
  assert.deepEqual(assistant.parts.map((part) => part.type), ["text", "step-finish", "tool", "step-finish", "text", "step-finish"])
  assert.deepEqual(assistant.tool_calls, [{ id: "call_001", name: "launch", arguments: { app: "outlook" } }])
  assert.deepEqual(normalized[2], {
    id: "call_001:result", role: "tool", tool_call_id: "call_001", tool_name: "launch", content: "exit 0",
    created_at: new Date(CREATED).toISOString()
  })
})

test("a busy turn yields finish=tool-calls and no trailing step-finish", () => {
  const normalized = normalizeAcpMessages([
    assistantMessage([
      { type: "text", text: "正在处理" },
      { type: "tool", tool: "search", callID: "call_002", state: { status: "running", input: { q: "x" } } }
    ])
  ], { busy: true })
  const assistant = normalized[0]
  assert.equal(assistant.info.finish, "tool-calls")
  assert.equal(assistant.parts.at(-1).type, "tool") // still running, no trailing finish
  assert.equal(normalized.length, 1) // no tool result while running
})

test("status mapping covers the ACP vocabulary", () => {
  assert.equal(acpStatusToSpec("pending"), "running")
  assert.equal(acpStatusToSpec("running"), "running")
  assert.equal(acpStatusToSpec("completed"), "completed")
  assert.equal(acpStatusToSpec("error"), "error")
  assert.equal(acpStatusToSpec("incomplete"), "error")
  assert.equal(acpStatusToSpec(undefined), "running")
})
