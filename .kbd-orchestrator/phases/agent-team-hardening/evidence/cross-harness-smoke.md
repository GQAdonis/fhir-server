# Cross-harness smoke tests — 5 domain roles (task 3.1)

Prompt used for every headless call (synthetic data only, no tools required to answer):

> In one sentence, state your role and which patient-data lane you must use for a synthetic Patient named Test Synthetic.

Roles: `hipaa-privacy-officer`, `fhir-integration-specialist`, `ehr-integration-manager`, `data-sync-coordinator`, `billing-prior-auth-specialist`.

CLI versions on this machine: `claude` 2.1.283, `codex` 0.154.0, `opencode` 1.18.25-fork, `kimi` 0.42.0, `mcode` 0.5.4.

No PHI, real endpoints or credentials were used or produced. Excerpts below are the model's own text output; nothing was echoed from repository secrets.

## Claude Code — PASS (5/5)

Command shape: `claude -p --agent <role> --permission-mode plan "<prompt>"` (most restrictive non-interactive mode that still lets the model answer; `plan` disallows edits).

| Role | Exit | Loaded | Excerpt |
|---|---|---|---|
| hipaa-privacy-officer | 0 | yes | "I'm the HIPAA privacy officer for this project: I review PHI flows and recommend decisions to the designated privacy official... can be used on the synthetic-data lane..." |
| fhir-integration-specialist | 0 | yes | "I'm the fhir-integration-specialist... a synthetic Patient named "Test Synthetic" belongs on the default synthetic lane, using public sandboxes such as SMART Health IT, HAPI..." |
| ehr-integration-manager | 124 (timeout after full answer printed) | yes | "I'm the ehr-integration-manager... for a synthetic Patient named Test Synthetic, I use only the synthetic/public-sandbox lane... per the phi-lane-policy." |
| data-sync-coordinator | 0 (re-run; see note) | yes | "I'm the **data-sync-coordinator**... "Test Synthetic" is synthetic data, it must run on the **synthetic lane**... not the Tribe PHI lane." |
| billing-prior-auth-specialist | 0 | yes | "I'm the billing-prior-auth-specialist... A synthetic Patient named "Test Synthetic" goes on the **synthetic lane**..." |

Notes:
- `ehr-integration-manager`'s first run printed a complete, correct answer but the process itself exited 124 (60s timeout) because two unrelated, pre-existing local `SessionEnd` hooks (`node ${CLAUDE_PLUGIN_ROOT}/dist/index.js session-end` and `npx -y -p @ory/claude-code@0.9.0 ory-claude-hook`, both machine-local plugin config, not part of this repo's `.claude/hooks/`) logged `failed: Hook cancelled` after the answer was already emitted. Same two lines appear after every successful Claude run in this session; they do not affect the model's answer.
- `data-sync-coordinator`'s first attempt (run back-to-back with the other three in one shell loop) also hit the same 60s per-call timeout with no output captured before the timeout; a solo re-run with a 90s timeout completed cleanly (exit 0) with the excerpt above.

## Codex — PASS (5/5)

Command shape: `codex exec --sandbox read-only -c approval_policy=never "/<role> <prompt>" < /dev/null`. `--sandbox read-only` is the most restrictive Codex sandbox; `< /dev/null` closes stdin (Codex's `exec` reads additional input from stdin by default, which otherwise hangs headlessly with no TTY). The project is already trusted in Codex (`~/.codex/config.toml` has `[projects."/Users/gqadonis/Projects/TribeHealth/fhir-server"]` with `trust_level = "trusted"`), so no trust-prompt workaround was needed. Codex's `exec` subcommand has no `--agent` flag; the project's `.codex/config.toml` registers each role under `[agents.<id>]`, and prefixing the prompt with `/<role-id>` (the same convention `.codex/config.toml`'s generated comment references for interactive use) reliably loaded the role's `developer_instructions`.

| Role | Exit | Loaded | Excerpt |
|---|---|---|---|
| hipaa-privacy-officer | 0 | yes | "I am the HIPAA privacy officer, responsible for patient-data privacy and compliance, and must use the synthetic-data lane for the synthetic Patient "Test Synthetic."" |
| fhir-integration-specialist | 0 | yes | "I'm the FHIR integration specialist for partner EHR interoperability, and for the synthetic Patient named Test Synthetic I must use the synthetic-data sandbox lane." |
| ehr-integration-manager | 0 | yes | "I'm the EHR integration manager, responsible for partner onboarding, integration readiness, SLAs, and incident communications, and a synthetic Patient named Test Synthetic must use the synthetic-data sandbox lane." |
| data-sync-coordinator | 0 | yes | "I coordinate recurring EHR-to-FHIR data synchronization and must use the synthetic-data lane for the synthetic Patient named Test Synthetic." |
| billing-prior-auth-specialist | 0 | yes | "I am the billing and prior-authorization specialist, and for the synthetic Patient "Test Synthetic," I must use the synthetic-data lane, which permits cloud-model processing." |

Notes (unrelated to role loading, recorded for completeness): stderr on every Codex run carried pre-existing local warnings unrelated to this repo — a skills-extension traversal-limit error against `~/.TOOLS/skills/agents`, failed connections to a local MCP server at `127.0.0.1:9010` and `mcp.typeui.sh` (401 missing auth), and a failed websocket probe to `ws://127.0.0.1:11434` (an idle local Ollama-style port). None of these affected the exit code or the printed answer; they come from this machine's global Codex config, not from `.codex/` in this repo.

## OpenCode — FAIL to run headlessly (0/5), recorded and not worked around

Command shapes tried, in order:
1. `opencode run --agent hipaa-privacy-officer "<prompt>" < /dev/null` → exit 1. Exact output:
   ```
   ! agent "hipaa-privacy-officer" is a subagent, not a primary agent. Falling back to default agent
   Error: {"name":"UnknownError","data":{"message":"Unexpected server error. Check server logs for details.","ref":"err_eacc0c34"}}
   ```
2. `opencode run "@hipaa-privacy-officer <prompt>" < /dev/null` (mention syntax, no `--agent`) → exit 1, same generic `UnknownError`.
3. Baseline with no agent selection at all, `opencode run "Say hello" < /dev/null` → exit 1, same generic `UnknownError`. With `--print-logs --log-level DEBUG`, the underlying cause is:
   ```
   ProviderModelNotFoundError: Model not found: anthropic/claude-sonnet-4-5. Did you mean: claude-sonnet-4-5, claude-sonnet-4-5-20250929?
   ```
   i.e. this machine's OpenCode default-agent/default-model configuration (not anything under `.opencode/` in this repo) resolves to a model id the installed provider rejects.
4. Baseline with the repo's configured OpenCode model for this team (`--model kimi-for-coding/k3`, from `.agent-team/team.config.json`), `opencode run --model kimi-for-coding/k3 "Say hello in exactly three words" < /dev/null` → exit 124 (110s timeout). The transcript shows the model *did* answer ("Hello there friend") and then kept emitting a self-directed "Objective / Work State / Next Move" continuation block and never returned control to the CLI, so the process never exited on its own.

Root cause, in scope terms: every generated OpenCode role file under `.opencode/agents/*.md` correctly carries `mode: "subagent"` (required by `lint:agents`' harness checks — see `.claude/hooks/src/lib/harness-lint.mts`), and `opencode run --agent <id>` on this installed version (1.18.25-fork) only accepts primary agents, so it always falls back to the default agent — which itself is broken in this environment independent of our roster (wrong default model id, and the working fallback model doesn't terminate non-interactively). This is a local harness/auth/model-config limitation, not an agent-team-authoring defect, so per instructions it is recorded here rather than worked around (e.g., by changing role `mode` to primary, which would fail `lint:agents`' generated-section and mode checks and is not something this role should do to force a green smoke test).

No further per-role attempts were made for OpenCode: the failure above is structural (applies identically before any role-specific content is reached), so repeating it for the other four roles would reproduce the same three errors with no new information.

## Kimi Code — PASS (5/5)

Command shape: `kimi -p "<prompt>" --agent <role> < /dev/null`. `-p` runs one prompt non-interactively and exits; no `--yolo`/`--auto` flag was used (session default permissions), and the prompt needs no tool calls so no approval prompt was ever triggered.

| Role | Exit | Loaded | Excerpt |
|---|---|---|---|
| hipaa-privacy-officer | 0 | yes | "I am the HIPAA privacy officer providing decision support on PHI flows to the designated privacy official (45 CFR 164.530(a)); a genuinely synthetic Patient like "Test Synthetic" carries no PHI and may be processed on any lane..." |
| fhir-integration-specialist | 0 | yes | "I am the fhir-integration-specialist, designing and verifying FHIR-based patient data pulls from partner EHRs, and for a synthetic Patient named Test Synthetic I use the default synthetic lane..." |
| ehr-integration-manager | 0 | yes | "I am the ehr-integration-manager, owning the business side of partner EHR integrations... and for a synthetic Patient like Test Synthetic I work in the synthetic/sandbox lane..." |
| data-sync-coordinator | 0 | yes | "I'm the data-sync-coordinator, owning partner EHR sync schedules, reconciliation, and sync incidents under `docs/sync/**`; for a synthetic Patient named "Test Synthetic" I stay on the **synthetic lane**..." |
| billing-prior-auth-specialist | 0 | yes | "I am the billing-prior-auth-specialist — I determine what documentation, prior authorization, and appeals each procedure/payer requires... for a synthetic Patient like "Test Synthetic" I work on the default **synthetic lane**..." |

Notes: every run also printed a pre-existing, unrelated deprecation warning (`[loop_control] 'max_retries_per_step' is deprecated...`) from this machine's global Kimi config; it does not affect role loading or the answer.

## MiniMax Code — file presence verified (5/5); no interactive listing subcommand exists

`mcode --help` has no agent-listing subcommand (only `init`, `exec`, `acp`, `login`, `logout`, `update`, `provider`, `plugin`), so per the task's fallback this was verified by file presence under `.minimax/agents/` (would use `MINIMAX_DATA_DIR=.minimax` if an agent-listing command existed):

```
.minimax/agents/hipaa-privacy-officer/agent.md
.minimax/agents/fhir-integration-specialist/agent.md
.minimax/agents/ehr-integration-manager/agent.md
.minimax/agents/data-sync-coordinator/agent.md
.minimax/agents/billing-prior-auth-specialist/agent.md
```

All five files exist, each `agent.md`'s frontmatter `name` matches its directory, and all five are listed in `.minimax/agents/.team-agents.json`'s `roles` array (verified against the same array `install-exports.mjs` maintains). No `mcode` invocation was needed or made against real or synthetic patient data; this satisfies the spec's "file presence" verification for MiniMax.

## Summary matrix

| Harness | hipaa-privacy-officer | fhir-integration-specialist | ehr-integration-manager | data-sync-coordinator | billing-prior-auth-specialist |
|---|---|---|---|---|---|
| Claude Code | loaded, exit 0 | loaded, exit 0 | loaded, exit 124 (answer printed; unrelated SessionEnd hooks) | loaded, exit 0 (on re-run) | loaded, exit 0 |
| Codex | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 |
| OpenCode | not loaded — harness cannot run subagents headlessly on this install (see errors above) | not attempted (structural failure applies to all roles) | not attempted | not attempted | not attempted |
| Kimi Code | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 | loaded, exit 0 |
| MiniMax Code | file present | file present | file present | file present | file present |
