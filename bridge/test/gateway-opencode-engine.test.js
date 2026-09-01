// bridge/test/gateway-opencode-engine.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { createOpenCodeEngine } from "../src/gateway/engines/opencode-engine.js"

// A fake upstream that mimics the opencode server API the engine proxies.
function fakeUpstream() {
  const state = { sessions: new Map(), busy: new Set(), messages: new Map(), promptResolvers: [] }
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://upstream")
    const send = (body, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" })
      response.end(body === undefined ? "" : JSON.stringify(body))
    }
    if (request.method === "GET" && url.pathname === "/session/status") {
      return send(Object.fromEntries([...state.sessions.keys()].map((id) => [id, { type: state.busy.has(id) ? "busy" : "idle" }])))
    }
    if (request.method === "POST" && url.pathname === "/session") {
      const id = `ses_${state.sessions.size + 1}`
      state.sessions.set(id, { id, title: "t" })
      state.messages.set(id, [])
      return send({ id, title: "t", created_at: "2026-09-01T10:00:00Z", status: "idle" })
    }
    const promptMatch = url.pathname.match(/^\/session\/([^/]+)\/prompt_async$/)
    if (request.method === "POST" && promptMatch) {
      state.busy.add(promptMatch[1])
      state.messages.get(promptMatch[1])?.push({
        id: `msg_${state.messages.get(promptMatch[1]).length + 1}`,
        role: "assistant", content: "done",
        created_at: "2026-09-01T10:00:01Z",
        info: { role: "assistant", finish: "stop" },
        parts: [{ type: "text", content: "done" }, { type: "step-finish" }]
      })
      state.promptResolvers.push(() => state.busy.delete(promptMatch[1]))
      return send(undefined, 204)
    }
    const messageMatch = url.pathname.match(/^\/session\/([^/]+)\/message$/)
    if (request.method === "GET" && messageMatch) return send(state.messages.get(messageMatch[1]) ?? [])
    const abortMatch = url.pathname.match(/^\/session\/([^/]+)\/abort$/)
    if (request.method === "POST" && abortMatch) { state.busy.delete(abortMatch[1]); return send({ ok: true }) }
    if (request.method === "DELETE" && url.pathname.startsWith("/session/")) {
      state.sessions.delete(url.pathname.split("/")[2])
      return send({ ok: true })
    }
    if (request.method === "GET" && url.pathname === "/question") return send([])
    if (request.method === "GET" && url.pathname === "/permission") return send([])
    send({}, 404)
  })
  return { server, state }
}

async function withFakeUpstream(run) {
  const upstream = fakeUpstream()
  await new Promise((resolve) => upstream.server.listen(0, "127.0.0.1", resolve))
  const port = upstream.server.address().port
  try {
    return await run(upstream, port)
  } finally {
    upstream.server.close()
  }
}

test("session lifecycle and blocking prompt against a fake upstream", async () => {
  await withFakeUpstream(async (upstream, port) => {
    const engine = createOpenCodeEngine({ manageHost: false, upstreamPort: port, pollIntervalMs: 5, promptTimeoutMs: 2_000 })
    await engine.initialize()
    const { id } = await engine.createSession({ title: "t" })
    assert.equal(typeof id, "string")

    let promptDone = false
    const promptPromise = engine.prompt(id, { text: "hi", model: "zai/glm-5.2" }).then(() => { promptDone = true })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(promptDone, false) // still busy upstream
    assert.deepEqual(await engine.listSessionStatuses(), { [id]: { type: "busy" } })

    upstream.state.promptResolvers.pop()() // upstream goes idle
    await promptPromise
    assert.equal(promptDone, true)
    assert.deepEqual(await engine.listSessionStatuses(), { [id]: { type: "idle" } })

    const messages = await engine.listMessages(id)
    assert.equal(messages.length, 1)
    assert.equal(messages[0].info.finish, "stop")

    await engine.abort(id)
    await engine.deleteSession(id)
    assert.deepEqual(await engine.listSessionStatuses(), {})
    await engine.dispose()
  })
})

test("question and permission reads are proxied", async () => {
  await withFakeUpstream(async (_, port) => {
    const engine = createOpenCodeEngine({ manageHost: false, upstreamPort: port })
    await engine.initialize()
    assert.deepEqual(await engine.listQuestions(), [])
    assert.deepEqual(await engine.listPermissions(), [])
    await engine.replyQuestion("req_x", [["A"]])
    await engine.replyPermission("perm_x", { reply: "once" })
    await engine.dispose()
  })
})
