PLAN: agent-dev-team
Project: WSO2 FHIR Server
Date: 2026-09-24
OpenSpec available: YES (`openspec/`, schema `spec-driven`)
Changes to implement: 8

## Operator decisions (recorded 2026-09-24, before planning)

| Decision | Choice | Plan consequence |
|---|---|---|
| Agent naming | `fhir-` prefix | No project agent shadows the 73 user-level agents |
| Model mix | 5 opus / 5 sonnet / 1 haiku | Opus for tech-lead, ideation-strategist, architect, storage-search-engineer, security-compliance-reviewer |
| `.prometheus/` | **Commit everything** (ledger, session log, KB) | Change 2 must make the logs **metadata-only by construction**, and add a PHI/secret scan that blocks a committed log from carrying tool input or output. This is the highest-risk choice in the phase, so a guard is required, not optional |
| Machine-local skills (43 of 50) | Document + degrade | Change 8 documents the prerequisites. Every agent prompt names any missing skill and continues. Only `karpathy-guidelines` is vendored (change 4) |

## Scope cuts and trade-offs (explicit)

- **Not in scope:**
  - Rewriting the *global* KBD `hooks.json` (it belongs to `~/.claude/skills/kbd-process-orchestrator`). This repo overrides the three Karpathy boundary entries through `.kbd-orchestrator/hooks-config.json` instead.
  - Changing Go source beyond the one license-header fix.
  - Seeding `openspec/specs/`.
  - Adding golangci-lint to local tooling.
- **Python remains a dependency** of Karpathy boundary recording (`record-progress.py`). The Node wrapper resolves `python3`, then `python`, then `py -3`, and degrades to a warning. It cannot remove the dependency.
- **Committed compiled `.mjs`.** Contributors need no build step, at the cost of possible src/dist drift. Change 1 adds a freshness check, and CI enforces it (change 8).
- **Agent-scoped hooks are not used.** All hooks are project-level in `.claude/settings.json`, so behaviour is identical no matter which persona is active. Agent frontmatter carries only `skills`, `tools`, `model`, `effort` and `isolation`.
- **One license-header fix is included in change 1** (`internal/config/example_parse_test.go`). It is outside the phase goals, but the `license-header` blocking constraint would otherwise block archiving every change in this phase.

## CHANGE LIST (ordered)

1. **add-hooks-typescript-toolchain**: the TypeScript 7 → Node `.mjs` hook build, a shared hook runtime library, and a project `settings.json` skeleton.
   - Scope: `.claude/hooks/` (package.json, tsconfig, `src/lib/`, `dist/`), `.claude/settings.json`, one `.go` header
   - Depends on: NONE
   - Recommended agent: Claude Code (main session; the `fhir-*` agents don't exist yet)
   - Est. complexity: M
   - Complexity score: Medium (6 tasks, new module, no prior art in specs, no open decisions)
   - Model class: medium
   - Customer value: HIGH (foundation for every hook and for C1)
   - Details:
     - `.claude/hooks/package.json` pins `typescript@7.0.2` and `@types/node@24` as devDependencies, with scripts `build` (`tsc -p .`), `check:dist` and `test` (`node --test`).
     - `tsconfig.json` uses `module`/`moduleResolution: nodenext`, `target: es2023`, `strict`, `rootDir: src`, `outDir: dist`, and emits `.mjs` from `.mts`.
     - `src/lib/hook-io.mts` reads the stdin JSON, emits `hookSpecificOutput`, and exits 0 or 2.
     - `src/lib/paths.mts` resolves the project dir from `CLAUDE_PROJECT_DIR`, else `cwd`, and normalizes Windows separators.
     - `scripts/check-dist.mjs` recompiles into a temp dir and diffs it against `dist/`.
     - `node:test` unit tests cover the library.
   - Acceptance: `npm --prefix .claude/hooks ci && npm --prefix .claude/hooks run build && npm --prefix .claude/hooks test && npm --prefix .claude/hooks run check:dist` pass. `grep -L 'Apache License' $(git ls-files '*.go')` prints nothing.

2. **add-karpathy-agent-ledger**: continuous-improvement logging of every agent and session event, plus a cross-platform bridge to the Karpathy boundary recorder.
   - Scope: `.claude/hooks/src/{agent-ledger,karpathy-flush,karpathy-boundary,scan-prometheus}.mts` with compiled `dist/*.mjs`, the `scan:prometheus` npm script, `.claude/settings.json` hook registration, `.kbd-orchestrator/hooks-config.json`, `.prometheus/` layout and `.gitattributes`
   - Depends on: add-hooks-typescript-toolchain
   - Recommended agent: Claude Code
   - Est. complexity: L
   - Complexity score: High (9 tasks; crosses the Claude-hook, KBD-hook and pk boundaries; new ledger schema)
   - Model class: frontier
   - Customer value: HIGH (satisfies C2 "Karpathy logs everything")
   - Details:
     - **`agent-ledger`** handles `SubagentStart`, `SubagentStop`, `PostToolUseFailure`, `TaskCompleted` and `UserPromptSubmit`.
       - It appends to `.prometheus/agent-ledger.jsonl` under a JSON schema that allowlists fields: `ts`, `session_id`, `agent_type`, `agent_id`, `event`, `tool_name`, `outcome`, `kbd_phase`, `kbd_change`.
       - It **never records tool input, tool output or prompt text**; `UserPromptSubmit` records only its length and a hash.
     - **`karpathy-flush`** runs on `Stop`, `SessionEnd` and `PreCompact`. It condenses the ledger delta since the last flush into `.prometheus/raw/<ts>-session.md` and runs `pk ingest --scope project --source claude-hooks`. When pk is absent or times out (10s) it falls back to an outbox file.
     - **`karpathy-boundary`** is a Node wrapper around the machine-level recorder `record-progress.py`. It is not vendored, because the skill owns its schema, locks and outbox.
       - The recorder is resolved in order: `$KARPATHY_RECORDER`, then `$KBD_ORCHESTRATOR_ROOT/../karpathy-progress-memory/scripts/record-progress.py`, then `~/.claude/skills/karpathy-progress-memory/scripts/record-progress.py`, with `os.homedir()` for Windows paths.
       - The interpreter is resolved as `python3`, then `python`, then `py -3`.
       - If **either** the recorder or the interpreter is absent, the wrapper appends a `boundary_degraded` ledger event (so the boundary is still logged) and exits 0 with a warning.
       - The machine-level recorder is listed as a prerequisite in change 8. A project `.kbd-orchestrator/hooks-config.json` adds three **augment** entries (`task:after`, `change:after`, `phase:after`) that run `node … karpathy-boundary.mjs --boundary <kind>`.
       - Verified 2026-09-24: `shared/lib/hooks.sh` override mode only suppresses the built-in `report-progress` reporter. It cannot replace a built-in by id, so the global python/shell entries keep running.
       - The recorder is idempotent by canonical event identity. On Unix the second run returns `duplicate`; on Windows the global shell entry fails (`on_failure: warn`) and the Node entry records.
     - **`scan-prometheus`** (`src/scan-prometheus.mts` → `dist/scan-prometheus.mjs`, npm script `scan:prometheus`) is a PHI/secret scanner (SSN, MRN-like, email, phone, `Bearer`/`sk-`/DSN patterns). It exports `scanText()` for in-process use and has a CLI mode over `.prometheus/**`.
     - `karpathy-flush` builds the session note **in memory**, runs `scanText()` on it, and only then writes to a temp file and renames it into `.prometheus/raw/`. A hit aborts the write, appends a redacted-count-only ledger event, and exits 0 with a `systemMessage`. CI (change 8) re-scans the whole tree.
   - Acceptance:
     - Fixture-driven `node:test` cases prove disallowed fields are dropped and the scanner flags seeded PHI.
     - A live `SubagentStop` produces exactly one ledger line.
     - `karpathy-boundary.mjs --boundary task` exits 0 (recorded or degraded) with `python3` present, and also when it is shadowed from PATH.
     - With `pk` present, `pk list` shows the ingested session note.
     - With `pk` absent (PATH-shadowed), an outbox file is written under `.prometheus/outbox/` and the hook exits 0 with a `systemMessage` warning.
     - With the recorder path absent, `karpathy-boundary.mjs` exits 0 and writes one `boundary_degraded` ledger line.
     - A fixture note containing a seeded SSN is never written to `.prometheus/raw/`.

3. **add-guardrail-hooks**: project-rule enforcement and context hooks.
   - Scope: `.claude/hooks/src/{session-context,guard-generated,license-header,gofmt-check}.mts`, `.claude/settings.json`
   - Depends on: add-hooks-typescript-toolchain
   - Recommended agent: Claude Code
   - Est. complexity: M
   - Complexity score: Medium (6 tasks, one module, pattern established by change 1)
   - Model class: medium
   - Customer value: HIGH (G4: domain rules enforced mechanically, not only in prompts)
   - Details:
     - **`session-context`** (SessionStart) injects the KBD waypoint phase, derived next change and the `position-reminder.txt` head as `additionalContext`, within a 2 KB bound.
     - **`guard-generated`** (PreToolUse `Edit|Write`) denies writes to project-root-relative globs matched after path normalization:
       - `internal/basedef/*.gz`
       - `internal/store/testdata/**`
       - `.kbd-orchestrator/phases/*/progress.json`
       - `.kbd-orchestrator/current-waypoint.json`
       - `.kbd-orchestrator/current-waypoint.md`
       - `.kbd-orchestrator/position-reminder.txt`

       Each denial carries a reason naming the correct regeneration command.
     - **`license-header`** (PostToolUse on `*.go`) feeds a missing Apache header back to the agent.
     - **`gofmt-check`** (PostToolUse on `*.go`) runs `gofmt -l <file>` with a 10s timeout and feeds back on failure. It skips silently when `gofmt` is not on PATH.
     - All four are registered in exec form: `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/dist/<x>.mjs"]`.
   - Acceptance:
     - `node:test` covers each hook with stdin fixtures: deny JSON for a basedef path and for each exact `.kbd-orchestrator` path (including Windows-separator and absolute-path variants), feedback for a headerless `.go`, a pass for a clean file.
     - A live session edit of `internal/basedef/profiles-types.min.json.gz` is refused.

4. **add-architecture-agents**: the planning and design personas.
   - Scope: `.claude/agents/{fhir-tech-lead,fhir-ideation-strategist,fhir-architect}.md`, `.claude/skills/karpathy-guidelines/` (vendored)
   - Depends on: NONE (agents do not require the hooks; the ledger picks them up once change 2 lands)
   - Recommended agent: Claude Code
   - Est. complexity: M
   - Complexity score: Medium (5 tasks, markdown only, precedent in the assessment roster)
   - Model class: medium
   - Customer value: HIGH (G2 and G3 for the ideation and architecture lifecycle)
   - Details:
     - Each file carries frontmatter `name`, `description` (with explicit "use when…" triggers), `model: opus`, `tools` and `skills`, following the assessment roster.
     - The tech-lead holds the `Agent` tool and the hand-off map. It is also documented as a main-session agent: `claude --agent fhir-tech-lead`.
     - The architect's write scope is limited to `openspec/`, `docs/` and `DESIGN.md` through prompt rules, and it cites `DESIGN.md §N`.
     - Every prompt includes the "missing skill: name it, continue" rule and a "Karpathy: apply karpathy-guidelines; boundaries are recorded by hooks" section.
     - `karpathy-guidelines` is vendored so the Karpathy rules exist on a fresh clone.
   - Acceptance: `node .claude/hooks/dist/lint-agents.mjs` (delivered in change 8; until then, a manual frontmatter check) finds valid YAML, a known model, and skills that resolve or are listed as prerequisites. Each agent answers a one-line smoke prompt through the Agent tool.

5. **add-engineering-agents**: the implementation and test personas.
   - Scope: `.claude/agents/{fhir-go-developer,fhir-storage-search-engineer,fhir-test-engineer}.md`
   - Depends on: add-architecture-agents (reuses its prompt sections for skills-degrade and Karpathy, and the hand-off contract)
   - Recommended agent: Claude Code
   - Est. complexity: M
   - Complexity score: Medium (5 tasks)
   - Model class: medium
   - Customer value: HIGH (G2 and G4 for the development and testing lifecycle)
   - Details:
     - **go-developer**: `model: sonnet`, `isolation: worktree`.
     - **storage-search-engineer**: `model: opus`, `effort: high`. Its prompt encodes the domain rules with `DESIGN.md` section references:
       - fail-closed search (`UnsupportedParamError`, §4);
       - write-time `sp_*` extraction in the same transaction (§4);
       - no GIN on `resource_json` (§3);
       - RLS plus `SET LOCAL` tenant scope and a non-superuser role (§5);
       - schema changes bump `schema_version` and use explicit DROP+recreate (§16);
       - registry DB-commit-before-memory (§6).
     - **test-engineer**: `model: sonnet`. Its prompt covers:
       - `internal/testutil` helpers;
       - `//go:build integration`;
       - race on store/handler (a CI parity command);
       - golden `UPDATE_GOLDEN=1`;
       - `FHIR_TEST_POSTGRES_IMAGE`;
       - keeping the `handler.StoreAPI` mock in sync.
   - Acceptance: same lint and smoke as change 4. The storage prompt cites every blocking constraint in `.kbd-orchestrator/constraints.md` that touches store, index or db.

6. **add-quality-agents**: the review and validation personas.
   - Scope: `.claude/agents/{fhir-code-reviewer,fhir-security-compliance-reviewer,fhir-conformance-validator}.md`
   - Depends on: add-architecture-agents
   - Recommended agent: Claude Code
   - Est. complexity: M
   - Complexity score: Medium (5 tasks)
   - Model class: medium
   - Customer value: HIGH (the validation lifecycle, and the gate before `/opsx:archive`)
   - Details:
     - All three are read-only: `tools: Read, Grep, Glob, Bash` and `disallowedTools: Edit, Write`.
     - **code-reviewer** (sonnet) checks diffs against the `CLAUDE.md` conventions and `constraints.md`.
     - **security-compliance-reviewer** (opus) checks PHI in logs, fixtures and errors, RLS bypass, SQL injection in `search.go`, tenant leakage, and **the committed `.prometheus/` content**.
     - **conformance-validator** (sonnet) runs `opsx:verify` and `kbd-goal-check`, plus `make test` and, when applicable, the store/handler race-integration command.
     - Each emits findings in the adversarial-review severity scale (CRITICAL / WARNING / SUGGESTION).
   - Acceptance: lint and smoke pass. Given a seeded diff that drops a search predicate, the code-reviewer flags it CRITICAL (fail-closed rule).

7. **add-infra-and-knowledge-agents**: the rollout persona and the Karpathy curator.
   - Scope: `.claude/agents/{fhir-infra-release-engineer,fhir-knowledge-curator}.md`
   - Depends on: add-architecture-agents, add-karpathy-agent-ledger (the curator's prompt documents the ledger schema and flush flow)
   - Recommended agent: Claude Code
   - Est. complexity: S
   - Complexity score: Low (3 tasks, markdown only, direct analog in changes 4–6)
   - Model class: small
   - Customer value: MEDIUM
   - Details:
     - **infra-release-engineer** (sonnet) owns `.github/workflows/`, `helm/`, `Dockerfile` and `docker-compose.yml`. Its standing rules:
       - SHA-pin every action (it lists the current `release.yml` tag-pinned drift as known debt);
       - keep CI parity with the local `make` targets;
       - `helm-lint` needs a secret placeholder;
       - the release is `workflow_dispatch` with a version stamp.
     - **knowledge-curator** (haiku) reads the ledger and `.prometheus/raw/`, runs `pk lint`/`pk ingest`, drafts the Karpathy section of `reflection.md`, and runs `scan-prometheus` before any commit.
   - Acceptance: lint and smoke pass. The curator condenses a fixture ledger into a session note and passes the PHI scan.

8. **document-and-verify-agent-team**: the team documentation, config alignment, and machine-checked verification in CI across macOS, Linux and Windows.
   - Scope: `docs/agent-team.md`, a `CLAUDE.md` section, `.kbd-orchestrator/project.json` `model_policy` / `preferred_*`, `.claude/hooks/src/lint-agents.mts`, `.github/workflows/agent-tooling.yml`
   - Depends on: changes 1–7
   - Recommended agent: Claude Code (this change is the first dogfood of the `fhir-tech-lead` → `fhir-infra-release-engineer` / `fhir-conformance-validator` hand-off)
   - Est. complexity: M
   - Complexity score: Medium (7 tasks)
   - Model class: medium
   - Customer value: HIGH (G5, and proves C1 on Windows)
   - Details:
     - **`docs/agent-team.md`** covers:
       - the roster and model rationale;
       - the persona → KBD/skill matrix;
       - the hand-off diagram;
       - a prerequisites table listing the 43 machine-local skills and their source plugin or ECC pack;
       - a Karpathy logging data-flow description and PHI policy.
     - **`lint-agents.mts`** validates frontmatter, known model aliases, and that `tools` and `skills` resolve locally or appear in the prerequisites.
     - **`project.json`** `model_policy.registry` and `preferred_*` are aligned with the roster (Opus 5.5 / Sonnet 5 / Haiku 4.5).
     - **CI workflow** `agent-tooling.yml`:
       - runs on a matrix of `ubuntu-latest`, `macos-latest` and `windows-latest` with Node 24 and SHA-pinned actions;
       - steps: `npm ci`, `build`, `test`, `check:dist`, `lint-agents`, `scan:prometheus` (the scanner is delivered in change 2);
       - also pipes a SubagentStop fixture into `node dist/agent-ledger.mjs` to prove the Windows exec form.
   - Acceptance: the workflow passes on all three OSes (via `act` locally, or a PR run). `/agents` lists the 11 `fhir-*` agents. Goal-check marks G1–G5 plus C1 and C2 MET.

## EXECUTION ROUND ORDER
- Round 1 (parallel): add-hooks-typescript-toolchain, add-architecture-agents
- Round 2 (parallel): add-karpathy-agent-ledger, add-guardrail-hooks, add-engineering-agents, add-quality-agents
- Round 3: add-infra-and-knowledge-agents
- Round 4: document-and-verify-agent-team

## Goal and constraint traceability

| Goal / constraint | Changes |
|---|---|
| G1 analyze | done in assess (MET) |
| G2 define agents with model and tools | 4, 5, 6, 7 |
| G3 persona → KBD skill mapping and hand-offs | 4 (contract), 5–7 (per persona), 8 (matrix doc) |
| G4 encode domain rules | 3 (mechanical), 5, 6 (prompts) |
| G5 document and verify | 8 |
| C1 TS7 → `.mjs`, cross-platform | 1, 2, 3, 8 (Windows CI) |
| C2 Karpathy logs everything | 2, 4 (vendored guidelines), 7 (curator), 8 (doc + scan in CI) |

## Risks
- **PHI in committed logs.** The operator chose to commit everything. Mitigations: an allowlisted ledger schema, a prompt-hash-only record, `scan-prometheus` in flush and in CI, and security-reviewer ownership. Residual risk: a curated `raw/` note hand-edited by a human.
- **Hook latency.** `gofmt-check` runs on every `.go` edit, with a 10s cap. The ledger appends are O(1).
- **Windows `node` on PATH.** Exec form requires `node` to resolve; this is documented as a prerequisite and checked by CI.
- **KBD lifecycle itself still needs bash on Windows.** Verified: the per-id override is unavailable, so change 2 uses augment entries. But `shared/lib/hooks.sh` and the KBD skills are bash libraries owned by the global orchestrator. The Claude Code hooks in this repo are fully cross-platform. KBD stage hooks on Windows require Git Bash (Claude Code already prefers Git Bash for shell-form hooks). This is documented in change 8 and is **out of scope** to rewrite here.

## COMMANDS TO RUN
```
/opsx:new add-hooks-typescript-toolchain
/opsx:new add-architecture-agents
/opsx:new add-karpathy-agent-ledger
/opsx:new add-guardrail-hooks
/opsx:new add-engineering-agents
/opsx:new add-quality-agents
/opsx:new add-infra-and-knowledge-agents
/opsx:new document-and-verify-agent-team
```

## Unresolved review findings

Adversarial review, artifact mode. Judge: gpt-5.5 over the REST gateway, `cross_model_check: verified-distinct`.

**Round 1** returned 1 CRITICAL and 2 WARNING findings, all fixed:
- `scan-prometheus` was added explicitly to change 2's scope and npm scripts.
- The guard globs are now exact `.kbd-orchestrator/...` paths with separator and absolute-path tests.
- The session note is scanned in memory before it is written.

**Round 2** returned 1 CRITICAL and 2 WARNING findings. The two-round cap was reached, so these were fixed after the last review and have **not been re-reviewed**:
- **CRITICAL: recorder dependency undefined.** Fixed: change 2 now defines how the recorder is resolved, and a missing recorder degrades to a ledger event with exit 0, with acceptance cases for both.
- **WARNING: `pk`-absent acceptance contradicted degrade behavior.** Fixed: acceptance is split into pk-present, pk-absent and recorder-absent cases.
- **WARNING: `release.yml` drift "unsupported".** Not a defect. `.github/workflows/release.yml` exists; the packet's file tree omits dot-directories. The evidence is in `evidence/assess-evidence.txt` (tag-pinned `actions/checkout@v4` and `actions/setup-go@v5`).

Execute should treat the round-2 fixes as unvetted and have `fhir-conformance-validator` check them during change 2.

Findings files: `review/plan/findings-round1.json`, `review/plan/findings.json`.

PLAN COMPLETE
