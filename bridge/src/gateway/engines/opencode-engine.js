// bridge/src/gateway/engines/opencode-engine.js（Task 5 的最小骨架，Task 7 完成全部方法）
import { ManagedOpenCodeHost } from "../../opencode-host.js"

export const OPENCODE_CAPABILITIES = { questions: true, permissions: true, abort: true }

export function createOpenCodeEngine(options = {}) {
  const listeners = new Set()
  return {
    id: "opencode",
    label: "OpenCode",
    capabilities: OPENCODE_CAPABILITIES,
    initialize: async () => {},
    dispose: async () => {},
    createSession: async ({ title, directory } = {}) => { throw new Error("not implemented yet") },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
