ASSESSMENT: agent-dev-team
Project: WSO2 FHIR Server
Date: 2026-09-24
Codebase baseline: A mature Go 1.25+ / PostgreSQL FHIR R4 server (~31.6k Go lines across 20 `internal/` packages). It has a green unit suite and a four-workflow GitHub Actions setup. It has no project-scoped Claude agents or hooks, and this is the first KBD phase.
Cross-tool progress: none. This is the first phase; `progress.json` shows 0/0 changes and no prior reflection.

---

## Scope clarification

In the invocation, the operator asked to "determine what agents are needed … and create them in `.claude`".
Under the KBD lifecycle, **assess is fact-finding only**. This document determines the roster, the constraints and the gaps.
The agent, hook and settings files are **created in `/kbd-plan` → `/kbd-apply`**, where each gets tasks, verification and Karpathy boundary records.
Nothing under `.claude/agents/` or `.claude/hooks/` was written in this stage.

## Research basis (Anthropic specs, fetched 2026-09-24 via Firecrawl)

Source: `code.claude.com/docs/en/sub-agents` and `code.claude.com/docs/en/hooks`.

**Subagent file format.** Markdown with YAML frontmatter.
- Required fields: `name`, `description`.
- Optional fields: `tools`, `disallowedTools`, `model` (`sonnet|opus|haiku|fable|inherit`), `permissionMode`, `maxTurns`, `skills` (preloaded into context), `mcpServers`, `hooks` (agent-scoped, cleaned up when the agent finishes), `memory` (`user|project|local`), `background`, `omitClaudeMd`, `effort`, `isolation: worktree`, `color`, `initialPrompt`, `experimental`.

**Precedence and nesting.**
- Load order, highest first: managed settings > `--agents` CLI > **`.claude/agents/`** > `~/.claude/agents/` > plugin agents.
- Subagents may spawn subagents up to 3 levels deep (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`).

**Hooks.**
- Configured in `settings.json` as `hooks.<Event>[].{matcher, hooks[].{type, command, args, timeout, shell, async}}`.
- Relevant events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `TaskCompleted`, `Stop`, `PreCompact`, `SessionEnd`.
- Input arrives as JSON on stdin (`session_id`, `cwd`, `hook_event_name`, plus `agent_id` / `agent_type` inside subagents).
- Exit code 2 blocks. Structured control goes through `hookSpecificOutput` (`permissionDecision`, `additionalContext`).

**Cross-platform.**
- **Exec form** (`"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/…/x.mjs"]`) spawns directly with no shell.
- Shell form defaults to `sh` on Unix and Git Bash or PowerShell on Windows.
- Exec form + Node is therefore the documented portable path, and it satisfies the "no shell scripts" constraint.

**Toolchain facts.**
- `typescript@latest` is **7.0.2**: the Go-native compiler, now shipped in the mainline `typescript` package.
- Local Node is v24.16.0.
- The repo has **no root `package.json`**; only `website/` has one.

---

## IMPLEMENTATION STATUS

- **Project agent roster (`.claude/agents/`): MISSING.** The directory does not exist. `.claude/` contains only the OpenSpec skills and `commands/opsx`.
- **Project hooks (`.claude/settings.json` + hook scripts): MISSING.** There are no project settings. User-level hooks exist (`Notification`, `Stop`, `UserPromptSubmit`) but are shell/inline commands in `~/.claude/settings.json`, outside this repo.
- **TypeScript 7 hook toolchain: MISSING.** There is no `package.json`, `tsconfig.json` or compile step for hook sources.
- **Karpathy continuous-improvement logging: PARTIAL.**
  - What exists: `karpathy-progress-memory` is installed and wired into the *global* KBD `hooks.json` for `task:after`, `change:after` and `phase:after`. Both files live **outside this repo** and were verified on disk:
    - `~/.claude/skills/kbd-process-orchestrator/hooks/hooks.json` (7,685 B): entries `karpathy-progress-task-boundary`, `-change-boundary`, `-phase-boundary`.
    - `~/.claude/skills/karpathy-progress-memory/scripts/record-progress.py` (26,590 B, executable).
    - Nothing in the repo references either file; project-local wiring must be created in plan/apply.
  - Gap 1: those entries run `python3 …/record-progress.py` through a **POSIX shell string**, so they do not run on Windows.
  - Gap 2: they only fire on KBD boundaries. Nothing records **per-agent / per-subagent activity** (which persona ran, which skill, what outcome).
  - What exists: `karpathy-guidelines` is installed but is not referenced from any project artifact.
  - `karpathy-tokenizer` is explicitly reference-only (its SKILL.md records the decision not to hook-wire it) and is **out of scope**.
- **KBD integration: PARTIAL.** `.kbd-orchestrator/` holds `project.json`, `constraints.md` and this phase. Nothing yet maps the KBD skills (assess → analyze → plan → apply → reflect, the `opsx-*` commands, goal-check) to executing personas.
- **Domain rules captured for agents: PARTIAL.** `CLAUDE.md` and `constraints.md` capture them: fail-closed search, RLS tenancy, write-time indexing, no GIN index on `resource_json`, the license header, and race-clean integration tests. No agent prompt enforces them yet.
- **Existing CI/CD: DONE, but not agent-owned.**
  - `ci.yml` covers gofmt, vet, golangci-lint v2.12.2, unit tests with race, integration tests plus race integration for store/handler, and Helm lint/template.
  - The other workflows are `release.yml`, `docs-publish.yml` and `fhir262-conformance-pages.yml`.

## Skill inventory (verified 2026-09-24)

Every skill the roster below assigns was resolved on disk. **50 of 50 are present; 0 are missing.** Where they live:

| Location | Count | Skills |
|---|---|---|
| **project** (`.claude/skills/`, `.claude/commands/opsx/`, from `openspec init`) | 7 | openspec-explore, openspec-propose, openspec-ff-change, openspec-continue-change, openspec-update-change, opsx:apply, opsx:verify |
| **user** (`~/.claude/skills/`) | 41 | kbd-process-orchestrator, kbd-status, kbd-execute, kbd-next-phase, kbd-goal-check, kbd-goal, kbd-new-phase, kbd-assess, kbd-analyze, kbd-plan, kbd-apply, kbd-reflect, kbd-memory-recall, idea-refine, validate-idea, documentation-and-adrs, api-design, postgres-patterns, golang-patterns, tdd-workflow, karpathy-guidelines, karpathy-progress-memory, surgical-patch, database-migrations, golang-testing, test-driven-development, verification-loop, code-review-and-quality, adversarial-review, security-review, hipaa-compliance, healthcare-phi-compliance, security-and-hardening, ci-cd-and-automation, github-ops, gitops-bootstrap, kustomize-overlay, deployment-patterns, shipping-and-launch, llm-wiki, continuous-learning-v2 |
| **plugin** (`superpowers` 4.3.0 in the plugin cache) | 2 | superpowers:brainstorming, verification-before-completion |

**Portability gap (new).** 43 of the 50 skills are user- or plugin-scoped: they live on this machine only and are not in the repo.
- A contributor who clones the repo gets the agents but not those skills.
- Subagent `skills:` preload would then silently lack them.
- Plan must pick one fix:
  - (a) vendor the essential skills into `.claude/skills/`;
  - (b) document a prerequisite install (the ECC and superpowers plugins); or
  - (c) make each agent's prompt degrade gracefully and name the missing skill.
- The assessment recommends (b) plus (c), and vendoring only the small `karpathy-guidelines`.

## Determined agent roster (input to `/kbd-plan`)

**Naming.** Every agent is prefixed `fhir-` so it does not **silently shadow** the 73 user-level agents. `go-reviewer`, `security-reviewer`, `database-reviewer`, `healthcare-reviewer`, `planner`, `architect`, `devops-engineer` and `tdd-guide` already exist in `~/.claude/agents`, and project agents take precedence over them.

**Models.** Current family: Opus 5.5, Sonnet 5, Haiku 4.5, Fable 5.1.

| # | Agent | Lifecycle role | Model | Tools posture | Primary KBD / supporting skills |
|---|---|---|---|---|---|
| 1 | `fhir-tech-lead` | Orchestrator / persona router (main-session agent via `claude --agent`) | opus | Full, plus `Agent` | kbd-process-orchestrator, kbd-status, kbd-execute, kbd-next-phase, kbd-goal-check |
| 2 | `fhir-ideation-strategist` | Ideation, feature discovery, FHIR/IG research | opus | Read-only + web/firecrawl | superpowers:brainstorming, idea-refine, validate-idea, openspec-explore, kbd-goal, kbd-new-phase |
| 3 | `fhir-architect` | Specs, design, planning guidance, DESIGN.md steward | opus | Read + Write limited to `openspec/`, `docs/`, `DESIGN.md` | kbd-assess, kbd-analyze, kbd-plan, openspec-propose/ff/continue/update, documentation-and-adrs, api-design, postgres-patterns |
| 4 | `fhir-go-developer` | General implementation (handler, validate, fhirpath, config, ig) | sonnet | Full edit + Bash; `isolation: worktree` for parallel changes | kbd-apply, opsx:apply, golang-patterns, tdd-workflow, karpathy-guidelines, surgical-patch |
| 5 | `fhir-storage-search-engineer` | `internal/store`, `index`, `db`, `searchparam`: SQL, RLS, schema migrations | opus (effort high) | Full edit + Bash | kbd-apply, postgres-patterns, database-migrations, golang-patterns, karpathy-guidelines |
| 6 | `fhir-test-engineer` | Unit, testcontainers integration, race, conformance, golden snapshots | sonnet | Full edit on `*_test.go` + Bash | golang-testing, tdd-workflow, test-driven-development, verification-loop |
| 7 | `fhir-code-reviewer` | Go and domain-rule review of diffs | sonnet | Read-only + Bash (git diff, lint) | code-review-and-quality, adversarial-review, karpathy-guidelines |
| 8 | `fhir-security-compliance-reviewer` | PHI/HIPAA, RLS bypass, injection, tenant leakage | opus | Read-only + Bash | security-review, hipaa-compliance, healthcare-phi-compliance, security-and-hardening |
| 9 | `fhir-conformance-validator` | Checks the implementation against the spec and FHIR R4; gate before archive | sonnet | Read-only + Bash | opsx:verify, kbd-goal-check, verification-before-completion, verification-loop |
| 10 | `fhir-infra-release-engineer` | GitHub Actions, Helm, Docker, release workflow, supply chain | sonnet | Edit on `.github/`, `helm/`, `Dockerfile`, `docker-compose.yml` + Bash | ci-cd-and-automation, github-ops, gitops-bootstrap, kustomize-overlay, deployment-patterns, shipping-and-launch |
| 11 | `fhir-knowledge-curator` | Karpathy logging, reflection, session-log hygiene, pk ingest | haiku | Read + Write limited to `.prometheus/`, `.kbd-orchestrator/phases/*/reflection.md` | karpathy-progress-memory, kbd-reflect, llm-wiki, continuous-learning-v2, kbd-memory-recall |

**Persona hand-offs.** These mirror the KBD stages. Each hand-off is logged by the hooks.

```
ideation-strategist ──goals──▶ architect ──assess/plan/specs──▶ tech-lead
tech-lead ──dispatch per change──▶ go-developer | storage-search-engineer ⇄ test-engineer
                                   └─▶ code-reviewer + security-compliance-reviewer (parallel)
                                   └─▶ conformance-validator (opsx:verify, goal-check)
infra-release-engineer ◀── CI/Helm/release changes; runs on change:after for CI parity
knowledge-curator ◀── every SubagentStop / task|change|phase:after / Stop (Karpathy log)
```

## Determined hook set (input to `/kbd-plan`)

**Implementation.**
- Sources: `.claude/hooks/src/*.mts`, compiled with `typescript@7.0.2` (`tsc -p .claude/hooks`).
- Output: `.claude/hooks/dist/*.mjs`, **committed**, so contributors need no build step.
- Registration: exec form (`node` + `args`) with `${CLAUDE_PROJECT_DIR}`.
- Dependencies: Node built-ins only at runtime.

| Hook | Event / matcher | Purpose |
|---|---|---|
| `session-context.mjs` | SessionStart | Inject the KBD waypoint (phase, next command) and the tail of `.prometheus/session-log.md` as `additionalContext` |
| `guard-generated.mjs` | PreToolUse `Edit\|Write` | Deny edits to `internal/basedef/*.gz`, `internal/store/testdata/**` golden files, and `.kbd-orchestrator/**/progress.json` / waypoint projections |
| `license-header.mjs` | PostToolUse `Write\|Edit` on `*.go` | Report a missing Apache header back to the agent (non-blocking feedback) |
| `gofmt-check.mjs` | PostToolUse `Write\|Edit` on `*.go` | Run `gofmt -l` on the file and feed any diff back |
| `agent-ledger.mjs` | SubagentStart / SubagentStop / PostToolUseFailure | Append `{ts, session, agent_type, event, outcome}` to `.prometheus/agent-ledger.jsonl`. This is the Karpathy raw inbox |
| `karpathy-flush.mjs` | Stop / SessionEnd / PreCompact | Summarize the ledger delta into a `raw/` note and run `pk ingest --scope project`, degrading to the outbox if `pk` is absent |
| `karpathy-boundary.mjs` | (called by the KBD `hooks-config.json` override) | Node wrapper around `record-progress.py`. It resolves `python3`, then `python`, then `py -3` so the boundary recorder works on Windows |

---

## CROSS-TOOL PROGRESS
- NONE. No cross-tool activity is recorded. The OpenSpec and agent-tool scaffolding for Codex, OpenCode, Kimi, Zed and MiniMax was created in this session but has no changes.

## SPEC GAP SUMMARY
- **No canonical specs.** `openspec/specs/` is empty; the de facto specs are `DESIGN.md` and `CLAUDE.md`. Agent prompts must cite `DESIGN.md §N` rather than OpenSpec capabilities until specs are seeded. That seeding is a candidate first task for `fhir-architect`.
- **Hooks are Unix-only today.** Every existing KBD and user hook is shell-form. This does not meet the stated macOS/Linux/Windows requirement for this project's contributors.
- **Karpathy recorder depends on Python.** Contributors need `python3` (or `py`) even when hooks are Node. A Node wrapper can resolve the interpreter, but it can't remove the dependency; it can only degrade gracefully.
- **Model-policy mismatch.** `project.json` → `model_policy.registry.frontier` still names `claude-sonnet-4-6` (a template default) and Qwen local models. It should be aligned with the roster's model assignments in the plan.
- **`.prometheus/` is untracked and not gitignored.** Evidence: `git status --short .prometheus` → `?? .prometheus/`, and `git check-ignore -v .prometheus/project.json` → no match. A decision is needed on whether `session-log.md` and `agent-ledger.jsonl` are committed, which would be shared learning but could leak prompt content and needs a PHI caution, or ignored.

## BUILD HEALTH
- build check (`build-passes` constraint): **PASS**. Ran the exact constraint command `make build && make vet`.
- unit tests (`unit-tests-pass` constraint): **PASS**. Ran the exact constraint command `make test` (`go test -race -count=1 ./...`). All 15 packages with tests pass under the race detector (corrected from 16 during execute); 6 have no test files (cmd/server, compartment, db, obs, seed, tenant).
- integration/conformance: **UNKNOWN**. Not run in assess (Docker is up; deferred to verification).
- lint: **UNKNOWN**. `golangci-lint` is not installed locally, so `make lint` would fail.
- known violations: `internal/config/example_parse_test.go` is missing the Apache license header.
- test coverage: **PARTIAL**. Coverage was not measured; the listed packages have no tests.

## CONSTRAINT CHECK
- AGENTS.md violations: N/A. There is no `AGENTS.md`.
- constraints.md violations:
  - `license-header`: 1 violation (`internal/config/example_parse_test.go`).
  - `golangci-lint-clean`: cannot be evaluated locally (tool missing).
  - `build-passes`, `unit-tests-pass`, `gofmt-clean`: pass; each was run with its exact command.
  - `no-gin-on-resource-json`: pass (the check grep returns nothing).
  - `store-handler-race-clean`: not evaluated. It applies only to changes touching store, handler, index or db, and there is no such change yet.
  - `no-hardcoded-secrets`, `search-fail-closed`, `rls-tenant-scope`: not evaluated in assess. They are change-scoped review constraints and no code change exists yet.
- CI supply-chain inconsistency (warning): `release.yml` uses tag-pinned `actions/checkout@v4` and `actions/setup-go@v5`, while `ci.yml` and the docker steps are SHA-pinned. This is in scope for `fhir-infra-release-engineer`.

## GOAL PROGRESS
- **G1**, analyze the codebase, CI and agent/skill inventory: **MET**. Codebase and CI are covered above. The skill inventory resolves 50 of 50 assigned skills on disk; 43 are machine-local, a portability gap carried to plan.
- **G2**, define project agents with model, tools and responsibilities: **PARTIAL**. The roster is determined above; the files are not created (plan/apply).
- **G3**, map personas to KBD skills with hand-offs: **PARTIAL**. The mapping is drafted above; it is not yet encoded in agent `skills:` frontmatter or docs.
- **G4**, encode fhir-server domain rules into agents: **NOT MET**. The rules are identified; no agent prompts exist yet.
- **G5**, document the team and verify agents load: **NOT MET**.
- **Added constraint C1**, hooks written in TypeScript 7 compiled to Node `.mjs`, cross-platform: **NOT MET**. The design is determined; the toolchain is absent.
- **Added constraint C2**, Karpathy skills used to log everything: **PARTIAL**. KBD-boundary recording exists globally but is Unix/Python-only; per-agent activity logging is missing.

## Risks and open questions for analyze/plan
1. **Shadowing.** If the operator *wants* to override the user-level `go-reviewer` and others for this repo, drop the `fhir-` prefix. The assessment recommends keeping the prefix.
2. **Hook latency.** PostToolUse on every `.go` edit runs `gofmt`. It must be bounded (timeout ≤ 10s) and scoped to `*.go` paths.
3. **Logging vs PHI.** The ledger must record agent, event and outcome metadata only, never tool inputs or outputs, because FHIR fixtures can contain realistic patient data.
4. **Committed `dist/`.** Compiled output can drift from `src/`. The plan needs a check, for example a CI step or a hook test that compiles `.mts` and diffs it against `dist/`.
5. **Opus cost.** Five opus agents (tech-lead, ideation, architect, storage-search, security-compliance) is deliberate for correctness-critical areas. Plan should confirm the budget or downgrade ideation to sonnet.

ASSESSMENT COMPLETE

---

## Evidence

The raw command output behind every build, test, constraint, git-state, CI, global-wiring and skill-inventory claim above was captured in one pass and is stored at `evidence/assess-evidence.txt`, which sits next to this file.

## Unresolved review findings

Adversarial review, artifact mode. Judge: gpt-5.5 over the REST gateway, `cross_model_check: verified-distinct`; producer: claude-opus-5-5.

**Round 1** returned 3 CRITICAL and 2 WARNING findings. All were fixed:
- The skill inventory was added.
- The global paths are now cited.
- The exact `make build && make vet` and `make test` commands were run.
- `.prometheus` git evidence was added.

**Round 2** hit the two-round cap, so its findings are carried forward instead of re-vetted:
- **CRITICAL ×2 and WARNING ×3: evidence not visible in the review packet.** The packet contains only the repo file tree and the artifact. It cannot carry:
  - command output (build, test, license check, git status);
  - files outside the repo (`~/.claude/skills/*`, the plugin cache);
  - the contents of `.github/workflows/*`.

  These are packet-scope limitations, not factual errors. **Resolution:** the evidence is captured in `evidence/assess-evidence.txt`. `/kbd-plan` should treat each claim as verified *by that file* and re-run it if the file is older than the plan.
- **Carried forward to plan:** the skill portability gap. 43 of the 50 assigned skills are machine-local, so a fresh clone won't have them. It needs a decision.

Findings files: `review/assess/findings-round1.json`, `review/assess/findings.json`.
