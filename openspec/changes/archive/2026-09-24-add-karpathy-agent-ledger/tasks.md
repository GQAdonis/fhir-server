## 1. Ledger

- [x] 1.1 Implement `src/lib/ledger.mts` (allowlisted field builder, sha256 prompt hash, single-line append, KBD phase/change read from `current-waypoint.json`) with `node:test` proving `tool_input`/`tool_response`/`prompt` never appear in output; verify `npm --prefix .claude/hooks test` passes
- [x] 1.2 Implement `src/agent-ledger.mts` hook entry for SubagentStart/SubagentStop/PostToolUseFailure/TaskCompleted/UserPromptSubmit; verify piping a SubagentStop fixture into `node dist/agent-ledger.mjs` appends exactly one valid JSON line

## 2. PHI / secret scanner

- [x] 2.1 Implement `src/lib/scan.mts` `scanText()` (SSN, MRN-like, email, phone, Bearer, `sk-`, credentialed DSN; optional reviewed allowlist) and `src/scan-prometheus.mts` CLI plus `scan:prometheus` npm script; verify tests flag each seeded pattern, report file:line without echoing matches, and exit 0 on a clean tree

## 3. Flush to knowledge base

- [x] 3.1 Implement `src/karpathy-flush.mts` (cursor-based ledger delta → markdown note in memory → `scanText` → temp write + rename into `.prometheus/raw/` → queue in `.prometheus/outbox/` → detached `pk-drain` running `pk ingest --scope project --source claude-hooks` (120s per note; revised during apply after measuring ~12s ingest latency, see design.md); `flush_blocked` on scan hit); verify tests for clean, PHI-seeded, and pk-absent (PATH-shadowed) cases
- [x] 3.2 Verify live: with `pk` present, run a flush and confirm `pk list` shows the note; with a seeded SSN fixture confirm nothing is written under `.prometheus/raw/`

## 4. KBD boundary bridge

- [x] 4.1 Implement `src/karpathy-boundary.mts` (recorder and interpreter resolution per design, pass-through of `KBD_HOOK_*` env, result appended to ledger, `boundary_degraded` + exit 0 when unresolved); verify tests for recorder-present, python-absent, and recorder-absent cases
- [x] 4.2 Create `.kbd-orchestrator/hooks-config.json` with three `augment` entries (task/change/phase `:after`) running the Node bridge; verify with `KBD_HOOK_DEBUG=1` that a sourced `kbd_hooks_fire task after` runs both the builtin and project entries and the second recorder call reports `duplicate`

## 5. Registration and layout

- [x] 5.1 Register `agent-ledger` and `karpathy-flush` in `.claude/settings.json` in exec form (flush on Stop, SessionEnd, PreCompact); create `.prometheus/{raw,outbox}/.gitkeep` and a `.gitattributes` entry marking `*.jsonl` as `linguist-generated`; verify `npm --prefix .claude/hooks run check:dist` passes and a live subagent run in this session appends a ledger line
