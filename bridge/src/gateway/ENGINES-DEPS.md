# 网关依赖闭包清单（ENGINES-DEPS）

网关打包（`node bridge/scripts/package-solution.mjs`）以从 `bridge/src/gateway/main.js` 出发的静态相对 import 扫描结果为准；本文件是人工核对基线，列出 engines/ 适配器直接 import 的 bridge 文件及其传递依赖。

最近一次实跑基线（2026-09-01，`node bridge/scripts/package-solution.mjs --list-deps` 实际输出，共 24 个文件）：

```
acp-client.js
acp-service.js
bounded-lru.js
codex-session-history.js
extension-actions.js
gateway/engines/acp-engine.js
gateway/engines/engine-adapter.js
gateway/engines/normalize-acp.js
gateway/engines/normalize-opencode.js
gateway/engines/opencode-engine.js
gateway/event-bus.js
gateway/gateway-server.js
gateway/interaction-queue.js
gateway/main.js
gateway/message-normalizer.js
gateway/options.js
gateway/session-registry.js
harness-profiles.js
launcher.js
omp-extension-action-state.js
omp-session-history.js
opencode-host.js
pi-session-history.js
transcript-cache.js
```

## drivers 直接依赖（engines/ 适配器 import）

- `src/acp-client.js`、`src/acp-service.js`、`src/harness-profiles.js`（acp-engine.js）
- `src/opencode-host.js`（opencode-engine.js）

## 传递依赖（由 acp-service/harness-profiles/launcher 等引入）

- `src/transcript-cache.js`（acp-service.js）
- `src/bounded-lru.js`（transcript-cache.js）
- `src/omp-session-history.js`、`src/pi-session-history.js`、`src/codex-session-history.js`（harness-profiles.js）
- `src/extension-actions.js`（acp-service.js、harness-profiles.js）
- `src/omp-extension-action-state.js`（extension-actions.js）
- `src/launcher.js`（harness-profiles.js 的 `findExecutable`；其自身又引用 opencode-host.js）

## 与任务书预期清单的核对结论

实跑闭包 = 任务书（Task 16 brief）所列「直接 + 传递」全部 12 个 bridge 驱动文件，不多不少；其余 12 个为网关自身模块（`gateway/` 目录，含 `engines/` 五个文件）。无差异需记录。

若后续重构导致 `--list-deps` 输出与本文件不符：以静态扫描结果为准打包，并在提交说明中更新本基线。
