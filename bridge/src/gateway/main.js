// bridge/src/gateway/main.js
import { pathToFileURL } from "node:url"
import { parseGatewayOptions, gatewayUsage } from "./options.js"
import { createEngine } from "./engines/engine-adapter.js"
import { createEventBus } from "./event-bus.js"
import { createSessionRegistry } from "./session-registry.js"
import { createInteractionQueue } from "./interaction-queue.js"
import { createGatewayServer } from "./gateway-server.js"

export function buildGateway(options) {
  const engine = createEngine(options.engine, options.engineOptions ?? {})
  const eventBus = createEventBus()
  const registry = createSessionRegistry()
  const interactionQueue = createInteractionQueue()
  const { server, askQuestion, askPermission } = createGatewayServer({
    engine, eventBus, registry, interactionQueue, defaultModel: options.defaultModel
  })
  // Engines that surface pending interactions push them through these two hooks.
  engine.onInteraction?.({
    askQuestion: (record) => askQuestion(record),
    askPermission: (record) => askPermission(record)
  })
  return { server, engine, eventBus, registry, interactionQueue }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseGatewayOptions(argv)
  if (options.help) {
    process.stdout.write(`${gatewayUsage()}\n`)
    return
  }
  const gateway = buildGateway(options)
  await gateway.engine.initialize()
  await new Promise((resolve) => gateway.server.listen(options.port, options.host, resolve))
  process.stderr.write(`gateway listening on http://${options.host}:${options.port} engine=${options.engine}\n`)
  const shutdown = async () => {
    gateway.server.close()
    await gateway.engine.dispose().catch(() => {})
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  })
}
