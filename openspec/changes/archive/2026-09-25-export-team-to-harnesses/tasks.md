## 1. Export

- [x] 1.1 Export the manifest to staging for claude, codex, opencode, kimi, minimax (`cli.mjs export`, new dirs under `.agent-team/exports/`); verify each export writes `export-receipt.json` and diagnostics are recorded in evidence with no errors
- [x] 1.2 Review diagnostics per harness and apply role `native.<target>` model/tool overrides from `evidence/model-map.md`; verify re-export diagnostics clean and each receipt records the adapter source/version

## 2. Install

- [x] 2.1 Implement `scripts/agent-team/install-exports.mjs` (copies only team role files, refuses non-team files, idempotent) with tests; verify tests pass including a refusal case
- [x] 2.2 Install into `.claude/agents/`, `.codex/agents/`, `.opencode/agents/`, `.kimi-code/agents/`, `.minimax/agents/`; record the `.claude/agents` before/after diff in evidence; verify each location holds exactly the 14 roles
- [x] 2.3 Implement `gen-agents-md` and generate `AGENTS.md` from `CLAUDE.md`; verify regeneration is byte-identical

## 3. Checks

- [x] 3.1 Extend `lint:agents` with per-harness structure checks, the card/PHI-lane check, and the drift check (temp export vs installed, plus AGENTS.md); verify it passes on the real tree and fails after a seeded hand edit in each harness
- [x] 3.2 Verify loading per harness: fresh `claude` session lists 14 agents; `opencode agent list`; `codex` smoke (`-c` with agent); `kimi --agent <id>` smoke; `MINIMAX_DATA_DIR=.minimax mcode` listing or file-presence evidence (no `exec` selector); record results in evidence
