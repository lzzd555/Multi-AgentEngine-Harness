// bridge/src/gateway/gateway-server.js
import { createServer } from "node:http"

function writeJSON(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  response.end(JSON.stringify(body))
}

function sendError(response, status, code, message) {
  writeJSON(response, status, { code, message })
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ""
    request.on("data", (chunk) => { raw += chunk })
    request.on("end", () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(Object.assign(new Error("request body is not valid JSON"), { statusCode: 400 }))
      }
    })
    request.on("error", reject)
  })
}

/** Engine failures map onto the spec's error table; ENGINE_UNAVAILABLE is a 502. */
function engineErrorResponse(error) {
  if (error?.code === "ENGINE_UNAVAILABLE") return [502, "BAD_GATEWAY", error.message]
  return [500, "INTERNAL_ERROR", error?.message ?? "internal error"]
}

export function createGatewayServer({
  engine,
  eventBus,
  registry,
  interactionQueue,
  defaultModel = "zai/glm-5.2"
}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://gateway")
      const path = url.pathname
      const method = request.method

      if (method === "GET" && path === "/event") return eventBus.handle(request, response)
      if (method === "GET" && path === "/health") return writeJSON(response, 200, { ok: true })

      if (method === "POST" && path === "/session") {
        const body = await readBody(request)
        if (typeof body.title !== "string" || !body.title.trim()) {
          return sendError(response, 400, "VALIDATION_ERROR", "title is required")
        }
        const directory = url.searchParams.get("directory") ?? undefined
        const { id } = await engine.createSession({ title: body.title, directory })
        const record = registry.register({ id, title: body.title })
        return writeJSON(response, 200, record)
      }

      if (method === "GET" && path === "/session/status") {
        return writeJSON(response, 200, registry.statuses())
      }

      const sessionMatch = path.match(/^\/session\/([^/]+)(?:\/(message|prompt_async|abort|stop|todo))?$/)
      if (!sessionMatch) return sendError(response, 404, "NOT_FOUND", "Not found")
      const sessionID = decodeURIComponent(sessionMatch[1])
      const action = sessionMatch[2]

      if (!action && method === "GET") {
        const record = registry.get(sessionID)
        if (!record) return sendError(response, 404, "NOT_FOUND", "Session not found")
        const messages = await engine.listMessages(sessionID)
        return writeJSON(response, 200, { ...record, message_count: messages.length })
      }

      if (!action && method === "DELETE") {
        if (!registry.has(sessionID)) return sendError(response, 404, "NOT_FOUND", "Session not found")
        await engine.deleteSession(sessionID)
        registry.remove(sessionID)
        return writeJSON(response, 200, { ok: true })
      }

      // message / prompt_async / abort / stop are implemented in the next task's continuation
      // of this router; unknown actions fall through to 404 until then.
      if (action) {
        const handled = await handleSessionAction({ request, response, url, sessionID, action, engine, registry, eventBus, interactionQueue, defaultModel })
        if (handled) return
      }
      return sendError(response, 404, "NOT_FOUND", "Not found")
    } catch (error) {
      if (error?.statusCode === 400) return sendError(response, 400, "VALIDATION_ERROR", error.message)
      const [status, code, message] = engineErrorResponse(error)
      return sendError(response, status, code, message)
    }
  })
}

async function handleSessionAction() {
  return false
}
