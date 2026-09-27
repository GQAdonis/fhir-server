# Export evidence (change export-team-to-harnesses)

Exporter: agent-team-creator `5f2d7a712f28`. Input: `.agent-team/team.json` (built by `build-manifest`, `--check` OK). Staging: `.agent-team/exports/20260925T153852Z/<target>/` (gitignored).

| Target | Exit | Role files | Receipt verification | Diagnostics (all informational, no errors) |
|---|---|---|---|---|
| claude | 0 | 14 `.claude/agents/*.md` (+ plugin copy, not installed) | source-verified, code.claude.com/docs/en/sub-agents; live unverified | native subagents, not an experimental agent team |
| codex | 0 | 14 `.codex/agents/*.toml` | source-verified, learn.chatgpt.com subagents | no plugin `agents` field emitted |
| opencode | 0 | 14 `.opencode/agents/*.md` | source-verified, opencode.ai/docs/agents | plugins are separate from agents |
| kimi | 0 | 14 `.kimi-code/agents/*.md` (+ plugin copy, not installed) | source-verified, MoonshotAI/kimi-code agents.md | Kimi ignores role model frontmatter (14 notes). Choose the model at invocation; the Harness card states it. |
| minimax | 0 | 14 `agents/<id>/agent.md` | source-verified, minimax-code canonical-agent-config.ts | `mcode exec` has no agent selector |

Task 1.2 (per-role native overrides from `evidence/model-map.md`) is already applied in the manifest by `build-manifest` (`roles[].native.{claude,codex,opencode,kimi,minimax}`). The re-export diagnostics are unchanged and error-free.

**Determinism:** a second export of the same manifest yields byte-identical role files for claude and codex (only `export-receipt.json`/`team-export.json` carry timestamps). This is the basis for the drift check.

**Format notes for the install and lint tasks:**
- Claude and OpenCode files use **JSON** frontmatter (valid YAML), which the existing `lint-agents` line parser does not read; task 3.1 extends it.
- The exporter appends a coordination footer to every prompt (team outcome, role, owns, inputs, outputs, dependencies, requested skills).

## Load verification per harness (task 3.2)

All runs used a synthetic, tool-free prompt: "In one line, state your role name and the paths you own."

| Harness | Method | Result |
|---|---|---|
| Claude Code | `claude -p … --agent <id> --max-turns 1` for `ehr-integration-manager` (sonnet) and `fhir-conformance-validator` (sonnet, read-only) | exit 0. Each answered from its **generated** prompt ("owns `docs/integrations/**`" / "owns `.agent-team/findings/fhir-conformance-validator/**`"), so the JSON frontmatter loads. `claude agents --json` lists sessions, not definitions, so it isn't used. |
| OpenCode | `opencode agent list` | all 14 roster roles listed as `(subagent)` |
| Codex | `codex exec`, spawning `ehr-integration-manager` | **First attempt failed:** "unknown agent_type". Codex 0.154 does not auto-discover `.codex/agents/*.toml`; agents must be registered under `[agents.<id>]` with a `config_file`. The fix: `install-exports` now generates `.codex/config.toml` registering all 14 roles (drift-checked; `lint:agents` requires every roster role to be registered). The project isn't trusted in the operator's Codex config, and project config applies only once it is (an operator action). Verified with a one-off `-c agents.<id>.config_file=…` override: the subagent spawned and replied "Role: ehr-integration-manager. Owned paths: `docs/integrations/**`." |
| Kimi Code | `kimi --agent ehr-integration-manager -p …` | exit 0, answered from the generated prompt ("owning `docs/integrations/**` … nothing else") |
| MiniMax Code | file presence (no `exec` agent selector, no agent-listing command) | 14/14 `.minimax/agents/<id>/agent.md` present with JSON frontmatter (name, description, skills, model). A `MINIMAX_DATA_DIR=.minimax mcode exec` probe failed with "Sign in to MiniMax to use Agent features": the data dir relocates **all** user data, including auth and provider config. The probe created runtime files (`auth/` with empty locks only, `config.yaml` without keys, `cache/`, `bin/`, `plugins/`, `integrations/`, `.builtin-skills/`, `shims/`, `v2/`). The ones the probe created before exiting were removed, and `.gitignore` now ignores all of `.minimax/` except `agents/` and `skills/`. See the operator question on ATH-D-003. |
