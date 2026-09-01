// bridge/test/gateway-import-boundary.test.js
import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const gatewayRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "gateway")

test("gateway core never imports outside the gateway package", () => {
  const coreFiles = readdirSync(gatewayRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
  assert.ok(coreFiles.length > 0, "gateway core files must exist")
  for (const entry of coreFiles) {
    const source = readFileSync(path.join(gatewayRoot, entry.name), "utf8")
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1])
    for (const specifier of imports) {
      const isBuiltin = specifier.startsWith("node:")
      const isLocal = specifier.startsWith("./")
      assert.ok(
        isBuiltin || isLocal,
        `${entry.name} imports "${specifier}" — gateway core may only use node: builtins and ./ relative imports`
      )
    }
  }
})

test("engine adapters stay inside the engines directory for bridge imports", () => {
  const enginesRoot = path.join(gatewayRoot, "engines")
  for (const entry of readdirSync(enginesRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue
    const source = readFileSync(path.join(enginesRoot, entry.name), "utf8")
    for (const specifier of [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1])) {
      assert.ok(
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier === "../../opencode-host.js" ||
          (specifier.startsWith("../") && !specifier.startsWith("../../")),
        `${entry.name} imports "${specifier}" — engines may only import node:, ./, gateway core (../) or the documented bridge drivers`
      )
    }
  }
})
