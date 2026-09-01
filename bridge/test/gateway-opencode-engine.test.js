// bridge/test/gateway-opencode-engine.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { createOpenCodeEngine } from "../src/gateway/engines/opencode-engine.js"
import { createFakeOpencodeUpstream } from "./helpers/fake-opencode-upstream.js"

async function withFakeUpstream(run) {
  const upstream = await createFakeOpencodeUpstream()
  try {
    return await run(upstream, upstream.port)
  } finally {
    await upstream.close()
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

test("question and permission reads tolerate upstream 404 text bodies", async () => {
  await withFakeUpstream(async (upstream, port) => {
    upstream.state.textNotFoundPaths.add("/question")
    upstream.state.textNotFoundPaths.add("/permission")
    const engine = createOpenCodeEngine({ manageHost: false, upstreamPort: port })
    await engine.initialize()
    assert.deepEqual(await engine.listQuestions(), [])
    assert.deepEqual(await engine.listPermissions(), [])
    await engine.dispose()
  })
})
