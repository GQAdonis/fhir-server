## 1. Capability discovery

- [x] 1.1 Verify each harness's hook mechanism against its installed version (Codex hooks events and payload; OpenCode plugin API `tool.execute.before`/`event`; Kimi hooks; MiniMax Code); record findings with doc/source links in `evidence/hook-capabilities.md`; verify every harness has a supported/partial/unsupported verdict with evidence

## 2. Adapters

- [x] 2.1 Implement `.claude/hooks/src/adapters/{codex,opencode,kimi}.mts` mapping native payloads to `hook-io` input and native decisions back (deny/allow/context); verify `node:test` fixture tests per adapter pass, including a protected-path deny
- [x] 2.2 Register adapters: Codex hook config (project), `.opencode/plugin/fhir-guards.js` calling the compiled adapters, Kimi config if supported; verify configs parse and `check:dist` passes

## 3. Verification

- [x] 3.1 Per supported harness, run a live or fixture session: a protected-path edit is denied and one ledger line is appended; record evidence per harness
- [x] 3.2 Write the capability matrix into `docs/agent-team.md`; verify it covers all five harnesses and matches `evidence/hook-capabilities.md`

## 4. Carried from export-team-to-harnesses

- [x] 4.1 De-flake `karpathy-boundary`: the Python interpreter probe (`PROBE_TIMEOUT_MS = 2000`) times out under parallel test load on a busy machine, so the pre-existing test "recorder present" intermittently sees `boundary_degraded` (observed 2026-09-25; the hook passes standalone in 1–2 s). Also seen: `flush.test.mjs` "detached drainer empties the outbox" failing with `ENOTEMPTY` during temp-dir cleanup (a race with the detached drainer). Raise the probe timeout, make the test assert the degraded reason on failure, and wait for or retry the drainer before cleanup; verify with 5 consecutive full `npm --prefix .claude/hooks test` runs green
