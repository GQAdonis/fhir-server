## 1. Guard

- [ ] 1.1 Implement `src/phi-lane-guard.mts` + `src/lib/phi-lane.mts` (URL extraction from WebFetch/MCP/Bash, FHIR-path match, sandbox allowlist from `phi-sandboxes.json`, lane proof via `PHI_LANE` + endpoint equality); verify `node:test` cases: production URL denied without lane, denied with `PHI_LANE=tribe` but mismatched endpoint, allowed with matching lane, sandboxes allowed, non-FHIR URLs allowed
- [ ] 1.2 Register `phi-lane-guard` in `.claude/settings.json` and every supported adapter from `wire-hooks-per-harness`; verify config inspection per harness plus one fixture run per harness

## 2. Templates

- [ ] 2.1 Write `.opencode/opencode.phi.template.json`, `.codex/config.phi.template.toml`, `.kimi-code/config.phi.template.toml` using only `TRIBE_MODEL_*` env vars; verify the PHI/secret scan and a URL grep find no real hosts or keys

## 3. Governance

- [ ] 3.1 Obtain `hipaa-privacy-officer` review (headless persona run with allowed read-only tools) of guard, allowlist, templates and role PHI-lane blocks; verify verdict PASS recorded in evidence
- [ ] 3.2 If any manifest role prompt changed, re-export all harnesses and run the drift check; verify `lint:agents` passes

## 4. Carried from define-portable-team-manifest security review

- [ ] 4.1 Tribe harness profiles deny, not just discourage, off-lane channels: Claude `permissions.deny` for `WebFetch`, `WebSearch` and `mcp__*` plus plugins disabled; the equivalent for Codex and OpenCode; knowledge-base and Karpathy reply-text Stop hooks disabled; transcript retention minimized; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Verify that the profile files contain the denies and that a fixture run on a Tribe profile blocks WebFetch
- [ ] 4.2 Ledger integrity: add a `rotate-ledger.mjs` hook script that moves ledger lines verbatim (replacing hand Edit/Write for rotation), and a ledger-key allowlist check in `scan-prometheus`. Remove `.prometheus/agent-ledger.jsonl` from the tech lead's Edit scope once the script exists. Verify with a node:test for rotation and an allowlist test that fails on an extra key
