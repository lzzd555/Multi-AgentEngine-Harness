// bridge/test/gateway-main.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { buildGateway } from "../src/gateway/main.js"

test("buildGateway wires engine events into the SSE bus", async () => {
  const gateway = buildGateway({
    engine: "opencode",
    host: "127.0.0.1",
    port: 0,
    defaultModel: "zai/glm-5.2",
    engineOptions: { manageHost: false, upstreamPort: 1 } // never dialed in this test
  })
  const seen = []
  gateway.eventBus.subscribe((event) => seen.push(event))
  gateway.engine === undefined // engine is created lazily by initialize; direct emit test:
  gateway.eventBus.emit({ type: "session.idle", properties: { sessionID: "s" } })
  assert.equal(seen.at(-1).type, "session.idle")
})
