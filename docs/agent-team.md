# Agent team

The WSO2 FHIR Server's agent team has **fourteen roles**, defined once in `.agent-team/team.json` (see [Portable team roster](#portable-team-roster)) and generated for every harness, plus a set of cross-platform hooks (`.claude/hooks/`). Together they run the KBD lifecycle (assess → plan → execute → reflect) with OpenSpec changes as the unit of work. Engineering roles are prefixed `fhir-`, so none silently replaces a user-level agent of the same name (decision D-001). The five domain roles use descriptive names; none collides with a user-level agent in any of the five harnesses (checked 2026-09-25).

Start a session led by the tech lead:

```bash
claude --agent fhir-tech-lead
```

Any session can also delegate to a persona by name, for example "use fhir-storage-search-engineer for this". Project agents load at session start, so start a new session after adding or editing an agent file.

## Retired agents

`fhir-ideation-strategist` merged into `fhir-architect`, and `fhir-knowledge-curator` merged into `fhir-tech-lead` (decision ATH-D-002, change `retire-merged-agents`). Ask the merge target for that work. Their definitions are removed from every harness.

## Portable team roster

The team is defined once, in `.agent-team/team.json`. It is built by `node scripts/agent-team/build-manifest.mjs` from `.agent-team/roles/<id>.md` and `.agent-team/team.config.json` (decision ATH-D-005), and `build-manifest --check` requires this table to list exactly the manifest roster, in order. The harness agent files for Claude Code, Codex, OpenCode, Kimi Code and MiniMax Code are generated from the manifest (change `export-team-to-harnesses`). 
Fourteen roles (decision ATH-D-002):
- the former ideation strategist merges into `fhir-architect`;
- the former knowledge curator merges into `fhir-tech-lead`;
- five domain roles are added.

PHI lanes follow the `phi-lane-policy` skill (ATH-D-001):
- `none`: never processes real PHI;
- `policy-only`: reviews PHI policy and flows, not content;
- `tribe-only`: real PHI only on a verified Tribe lane.

| Role | Tier | PHI lane | Owns (primary write paths) |
|---|---|---|---|
| `fhir-tech-lead` | hard | none | `.kbd-orchestrator/phases/*/goals.md`, `.kbd-orchestrator/phases/*/execution.md`, `.kbd-orchestrator/phases/*/execute-dispatch.json`, `.kbd-orchestrator/phases/*/reflection.md`, `.prometheus/raw/**`, `.prometheus/outbox/**`, `.prometheus/ledger/**`, `.prometheus/agent-ledger.jsonl` |
| `fhir-architect` | hard | none | `openspec/**`, `DESIGN.md`, `docs/*.md`, `docs/images/**`, `.kbd-orchestrator/phases/*/assessment.md`, `.kbd-orchestrator/phases/*/analysis.md`, `.kbd-orchestrator/phases/*/plan.md`, `.kbd-orchestrator/phases/*/evidence/**`, `.agent-team/team.json`, `.agent-team/roles/**` |
| `fhir-go-developer` | medium | none | `internal/handler/**`, `internal/validate/**`, `internal/fhirpath/**`, `internal/fhirxml/**`, `internal/fhirttl/**`, `internal/patch/**`, `internal/config/**`, `internal/ig/**`, `internal/terminology/**`, `internal/compartment/**`, `internal/obs/**`, `internal/version/**`, `cmd/server/**`, `website/docs/**` |
| `fhir-storage-search-engineer` | hard | none | `internal/store/*.go`, `internal/index/**`, `internal/db/**`, `internal/searchparam/**`, `internal/seed/**`, `internal/tenant/**` |
| `fhir-test-engineer` | medium | none | `internal/testutil/**`, `internal/conformance/**`, `internal/store/testdata/**` |
| `fhir-code-reviewer` | medium | none | `.agent-team/findings/fhir-code-reviewer/**` |
| `fhir-security-compliance-reviewer` | hard | none | `.agent-team/findings/fhir-security-compliance-reviewer/**` |
| `fhir-conformance-validator` | medium | none | `.agent-team/findings/fhir-conformance-validator/**` |
| `fhir-infra-release-engineer` | medium | none | `.github/workflows/**`, `.github/CODEOWNERS`, `.github/*TEMPLATE*`, `.gitignore`, `helm/**`, `Dockerfile`, `docker-compose.yml`, `Makefile`, `version.txt`, `.claude/hooks/**`, `.claude/agents/**`, `.claude/settings.json`, `.claude/skills/**`, `.agents/skills/**`, `.codex/**`, `.opencode/**`, `.kimi-code/**`, `.minimax/**`, `scripts/agent-team/**`, `AGENTS.md` |
| `hipaa-privacy-officer` | hard | policy-only | `docs/compliance/**` |
| `fhir-integration-specialist` | hard | tribe-only | `docs/interop/**` |
| `ehr-integration-manager` | medium | none | `docs/integrations/**` |
| `data-sync-coordinator` | medium | tribe-only | `docs/sync/**` |
| `billing-prior-auth-specialist` | hard | tribe-only | `docs/billing/**` |

## Per-harness limitations

Each harness has its own agent format and gaps. The generated Harness card on every role states the intended model, tools and permissions even where a harness ignores them.

| Harness | Where agents live | Limitation and what to do |
|---|---|---|
| Claude Code | `.claude/agents/<id>.md` (JSON frontmatter) | Project agents load at session start: start a new session after regenerating. |
| Codex | `.codex/agents/<id>.toml`, registered in `.codex/config.toml` | Codex does not auto-discover agent files; `install-exports` generates the `[agents.<id>]` registrations. Codex reads project config only after you **trust this project** in Codex. `install-exports` manages only the delimited `# >>> agent-team roles … >>>` block in `.codex/config.toml`: other project settings outside the markers are preserved, and editing inside the block fails the drift check. Gate roles run with `sandbox_mode = "read-only"`, and `lint:agents` rejects any other key in generated agents. |
| OpenCode | `.opencode/agents/<id>.md` (subagents) | Read-only roles get `permission.edit = deny`, and shell commands ask for approval except a read-only verification allowlist. OpenCode has no read-only sandbox, so an approved shell command could still write. Other roles use the session defaults. |
| Kimi Code | `.kimi-code/agents/<id>.md` | **Kimi ignores the per-agent model.** Choose it at invocation (`kimi -m kimi-code/k3 --agent <id>`). There is no per-agent permission field, so read-only roles are read-only by instruction. |
| MiniMax Code | `.minimax/agents/<id>/agent.md` (ATH-D-003) | **`mcode exec` has no agent selector** and there is no agent-listing command; pick the agent in an interactive session. MiniMax reads agents from `MINIMAX_DATA_DIR`, which relocates **all** of its user data, including login and provider config. Keeping the data dir inside the repo puts MiniMax login, session state and logs in the working tree. There other agents can read them, `docker build` could copy them, and backups include them, even though they are gitignored and `lint:agents` fails if anything but generated team files under `.minimax/` would be committed. **Prefer a data dir outside the repo** (for example copy `.minimax/agents/` to `~/.minimax/agents/`) until the operator decides (ATH-D-003 is under review). There is no per-agent permission field. |

Patient-data lanes apply in every harness: none of the models above is BAA-covered (see `phi-lane-policy`).

## Hook coverage per harness

The same compiled hooks (`.claude/hooks/dist/`) run in every harness that supports hooks, through `harness-hook.mjs`. It normalizes each harness's payload and answers in its native contract. Evidence: `.kbd-orchestrator/phases/agent-team-hardening/evidence/hook-capabilities.md`.

| Hook | Claude Code | Codex | OpenCode | Kimi Code | MiniMax Code |
|---|---|---|---|---|---|
| Protected-path guard (`guard-generated`) | supported | supported | supported | partial | partial |
| Agent ledger (`agent-ledger`, metadata only) | supported | supported | supported | partial | partial |
| License header, gofmt checks | supported | unsupported | unsupported | unsupported | unsupported |
| Karpathy flush / session context | supported | unsupported | unsupported | unsupported | unsupported |
| How it is wired | `.claude/settings.json` | `.codex/hooks.json` | `.opencode/plugins/fhir-guards.js` (auto-loaded) | `scripts/agent-team/plugins/fhir-guards` (user install: `/plugins install`, then `run.mjs --allow <repo>`) | same plugin, Claude-compatible format (user install: `mcode plugin install`, then `run.mjs --allow <repo>`) |
| Activation | always | **trust the project and each hook hash once** in Codex | always | after install; hooks are **fail-open** | after install and `mcode login`; not verified end to end |

- **Reduced protection where a hook is partial or unsupported:** generated files and KBD projections can be hand-edited without a guard. `lint:agents` (drift) and CI still catch drift in generated agent files, but not in other protected files. Run `npm --prefix .claude/hooks run lint:agents` before committing.
- The guard covers file-writing tools only (Edit/Write/patch). Shell commands are not guarded in any harness.
- **The guard fails open in every harness:** an adapter error, a timeout (10 s), a missing or unbuilt adapter, or unparseable output allows the write. CI (`check:dist`, `lint:agents`) is the backstop for compiled hooks and generated agent files. KBD projections and golden `testdata` have no CI backstop. The Codex commands locate the repo with `git`: without git, outside a repository, or when git refuses a repo with "dubious ownership", the Codex guard is silently off. On Windows it relies on Codex running `commandWindows` through `cmd.exe` (not verified).
- Sessions started in a subdirectory are guarded too. Every adapter resolves the git top level, and relative edit paths are resolved against the session directory first (so `../../AGENTS.md` from `internal/store` is denied).
- The Kimi/MiniMax plugin runs a repo's hooks **only for repositories you allow**: `node scripts/agent-team/plugins/fhir-guards/hooks/run.mjs --allow <repo>`, run interactively (or with `--yes`). The allowlist lives in your user config dir; one stored inside a repo is ignored. It trusts a path, not content: whatever you check out or pull into an allowed repo runs at session start. Without it, the plugin does nothing, so another repo cannot run code through it.
- The ledger records a harness session start as `SubagentStart` (with the harness as `agent_type`), plus prompt submits, and tool failures where the harness reports them: Claude, OpenCode (`session.error`), Kimi and MiniMax. **Codex has no tool-failure event, so Codex sessions record only session starts and prompts.** Per-turn stop events are not recorded.

## Persona → KBD stage and skill matrix

Preloaded skills are always repo-resident (see [Prerequisites](#prerequisites)). "Invoke" skills are machine-local.

| Agent | KBD stages / commands owned | Preloaded skills | Invoke when needed |
|---|---|---|---|
| `fhir-tech-lead` | `/kbd-execute`, `/kbd-status`, `/kbd-goal-check`, `/kbd-next-phase`, `/kbd-apply` dispatch | karpathy-guidelines | kbd-process-orchestrator, kbd-status, kbd-execute, kbd-apply, kbd-goal-check, kbd-next-phase, kbd-reflect, adversarial-review |
| `fhir-architect` (goal discovery) | `/kbd-new-phase` and `/kbd-goal` drafting | karpathy-guidelines, openspec-explore | idea-refine, superpowers:brainstorming, validate-idea, kbd-goal, kbd-new-phase, deep-research, firecrawl-search |
| `fhir-architect` | `/kbd-assess`, `/kbd-analyze`, `/kbd-plan`, `/opsx:new/ff/continue/update` | karpathy-guidelines, openspec-propose | kbd-assess, kbd-analyze, kbd-plan, openspec-*, documentation-and-adrs, api-design, postgres-patterns, adversarial-review |
| `fhir-go-developer` | `/kbd-apply` tasks (non-storage packages) | karpathy-guidelines, openspec-apply-change | kbd-apply, golang-patterns, golang-testing, tdd-workflow, surgical-patch, go-build-resolver (agent) |
| `fhir-storage-search-engineer` | `/kbd-apply` tasks (store, index, db, searchparam) | karpathy-guidelines, openspec-apply-change | kbd-apply, postgres-patterns, database-migrations, golang-patterns, golang-testing, database-reviewer (agent) |
| `fhir-test-engineer` | Test plans; CI-parity test runs | karpathy-guidelines, openspec-verify-change | golang-testing, test-driven-development, tdd-workflow, verification-loop, e2e-testing |
| `fhir-code-reviewer` | Code-review gate | karpathy-guidelines | code-review-and-quality, adversarial-review |
| `fhir-security-compliance-reviewer` | Security gate for sensitive paths | karpathy-guidelines | security-review, hipaa-compliance, healthcare-phi-compliance, security-and-hardening, healthcare-reviewer / security-reviewer (agents) |
| `fhir-conformance-validator` | Archive gate (`kbd-apply verify`, `/opsx:verify`), `/kbd-goal-check` | karpathy-guidelines | openspec-verify-change (read-only steps), kbd-goal-check, verification-loop, superpowers:verification-before-completion |
| `fhir-infra-release-engineer` | CI/CD and release changes | karpathy-guidelines | ci-cd-and-automation, github-ops, deployment-patterns, docker-patterns, shipping-and-launch, gitops-bootstrap, kustomize-overlay |
| `fhir-tech-lead` (curation) | Karpathy lessons for `/kbd-reflect` | karpathy-guidelines | karpathy-progress-memory, kbd-reflect, kbd-memory-recall, llm-wiki, continuous-learning-v2, knowledge-ops |

## Hand-offs

```
fhir-architect ──goals──▶ fhir-tech-lead ──/kbd-new-phase──▶ fhir-architect
fhir-architect ──assess / plan / OpenSpec changes──▶ fhir-tech-lead (/kbd-execute)
fhir-tech-lead ──/kbd-apply per change──▶ fhir-go-developer | fhir-storage-search-engineer
                                          ⇅ fhir-test-engineer (tests first, CI parity)
          ──change done──▶ fhir-code-reviewer ─┐
                           fhir-security-compliance-reviewer (sensitive paths) ─┤
                                                                                ▼
                                                   fhir-conformance-validator (last)
                                                                                │ PASS
                                                   fhir-tech-lead: kbd-apply verify → archive
fhir-infra-release-engineer ◀── CI, Helm, Docker, release work; CI-only failures
fhir-tech-lead ◀── phase end: ledger → Karpathy lessons → /kbd-reflect

Domain roles (manifest; PHI lanes per phi-lane-policy):
ehr-integration-manager ──intake──▶ hipaa-privacy-officer ──recommendation──▶ privacy official (operator) signs off
ehr-integration-manager ──technical discovery──▶ fhir-integration-specialist ──change request──▶ fhir-architect
fhir-integration-specialist ──schedule──▶ data-sync-coordinator ──ingest defects──▶ fhir-tech-lead
data-sync-coordinator ──possible PHI exposure──▶ hipaa-privacy-officer (immediately)
billing-prior-auth-specialist ──data gaps──▶ fhir-integration-specialist
```

- **Gate rules.** Any CRITICAL finding from a reviewer means BLOCK. For Go changes, archive requires either a local `make lint` pass or recorded evidence of a green CI lint job; unverified lint means BLOCK. Commits and pushes happen only when the operator asks.
- **Read-only personas** (the reviewers and the validator) never modify tracked files. Their Bash use is limited to verification. Commands that write into the repo (`make build` without `BINARY=` pointing outside it, `npm run build`) are not allowed for them.
- **`fhir-tech-lead`** edits only KBD phase records and curation paths (its manifest `owns`), never code, specs or configuration; its other Bash use is limited to KBD, OpenSpec and verification commands.

## Hooks

All hooks are TypeScript 7 sources (`.claude/hooks/src/*.mts`) compiled to committed Node ES modules (`.claude/hooks/dist/*.mjs`). They are registered in exec form (`"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/dist/<hook>.mjs"]`), so no shell is involved and they run the same on macOS, Linux and Windows. They use only Node built-ins at runtime.

| Hook | Event | Effect |
|---|---|---|
| `session-context` | SessionStart | Adds the KBD phase, the next change derived from task state, and the position-reminder head (≤ 2 KB) |
| `guard-generated` | PreToolUse (Edit/Write/MultiEdit/NotebookEdit) | Denies edits to `internal/basedef/*.gz`, `internal/store/testdata/**`, `.claude/hooks/dist/**` and KBD runtime projections, naming the correct regeneration command |
| `license-header` | PostToolUse (.go) | Feedback when the WSO2 Apache header is missing |
| `gofmt-check` | PostToolUse (.go) | Feedback when the file is not gofmt-clean (silent without gofmt) |
| `agent-ledger` | SubagentStart/Stop, PostToolUseFailure, TaskCompleted, UserPromptSubmit | Appends one metadata-only line to `.prometheus/agent-ledger.jsonl` |
| `karpathy-flush` | Stop, SessionEnd, PreCompact | Writes a scanned session note to `raw/` and `outbox/`; a detached `pk-drain` delivers it to the knowledge base |
| `karpathy-boundary` | KBD `task/change/phase:after` (`.kbd-orchestrator/hooks-config.json`) | Records KBD boundaries through the Karpathy progress recorder, and logs `boundary_degraded` when the recorder is unavailable |

Develop the hooks with:

```bash
npm --prefix .claude/hooks ci
npm --prefix .claude/hooks run build        # tsc (TypeScript 7.0.2) → dist/
npm --prefix .claude/hooks test             # node:test against dist/
npm --prefix .claude/hooks run check:dist   # committed dist/ matches src/
npm --prefix .claude/hooks run lint:agents  # agent files vs this document
npm --prefix .claude/hooks run scan:prometheus
```

## Karpathy logging: data flow and privacy policy

```
Claude Code events ──agent-ledger──▶ .prometheus/agent-ledger.jsonl   (metadata only, committed)
Stop / SessionEnd / PreCompact ──karpathy-flush──▶ scan ──▶ raw/<ts>-agent-activity.md (committed)
                                                   └──▶ outbox/ ──pk-drain (detached)──▶ pk ingest → project KB
KBD task/change/phase:after ──karpathy-boundary──▶ record-progress.py ──▶ session-log.md + receipts (committed)
fhir-tech-lead ──phase end──▶ Karpathy lessons in reflection.md
```

**What is recorded:**
- Timestamp, session id, agent type and id, event, tool name (only for tool failures), outcome, KBD phase and change.
- For prompts, only their character count.

**What is never recorded:**
- Prompt text, tool inputs, tool outputs, file contents.
- Any prompt hash (D-007).

Identifier fields are restricted to identifier characters and are scanned; anything else is dropped.

**Committed vs local** (D-003 as amended by D-006):
- Everything under `.prometheus/` is committed, except the conversation text and local-path caches:
  - `knowledge/wiki/karpathy-session-*.md`, written by the user-level `pk` Stop hook with assistant replies;
  - `knowledge/.prompt-snapshots/`;
  - `events.jsonl`.
- Local hook state (`.flush-cursor`, `.flush.lock`, `*.tmp`) is also ignored.

**Scanning:**
- Before a session note is written, its content is checked for SSN, MRN-like, email, phone, bearer-token, `sk-` key, AWS key, private-key and credentialed-DSN patterns. A match withholds the note and logs `flush_blocked`.
- `scan:prometheus` checks every committable file. CI runs it on every change to agent tooling.
- `.prometheus/scan-allowlist.json` may contain only synthetic emails (`example.*`, `.invalid`, `.test`, `.localhost`, `noreply@anthropic.com`).

Regex scanning cannot detect names, dates of birth or clinical free text. That is why the ledger is metadata-only by construction and `fhir-security-compliance-reviewer` reviews every change touching `.prometheus/`.

## Windows notes

- The Claude Code hooks need only `node` on PATH, and the exec form spawns no shell.
- The KBD orchestrator's stage hooks (`kbd_hooks_fire`, the `kbd-apply` driver) are bash libraries owned by the machine-level KBD install, so KBD stage commands on Windows need Git Bash (decision D-005). The Karpathy boundary recording has a Node entry (`karpathy-boundary`) for exactly this reason.
- Python for the boundary recorder is resolved as `python3`, then `python`, then `py -3`.

## Prerequisites

The agents preload only skills that live in this repository: the vendored `karpathy-guidelines`, the OpenSpec skills installed by `openspec init`, and the domain skills in `.agents/skills/` (provenance in `.agents/skills/SOURCES.json`, mirrored to every harness by `node scripts/agent-team/mirror-skills.mjs`). So every agent loads on a fresh clone.

The skills and helper agents below are **machine-local**. They are installed per developer, not committed. Each agent names them under *Invoke when needed*. When one is missing, the agent says `missing skill: <name>` once and continues with manual steps.

Install the source packs listed here to give every agent its full capability. The `lint:agents` check reads this block, so keep it in sync with the agent files.

```yaml
prerequisites:
  - name: adversarial-review
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect, fhir-code-reviewer, fhir-tech-lead]
  - name: api-design
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-architect]
  - name: ci-cd-and-automation
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-infra-release-engineer]
  - name: code-review-and-quality
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-code-reviewer]
  - name: continuous-learning-v2
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-tech-lead]
  - name: database-migrations
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-storage-search-engineer]
  - name: database-reviewer
    kind: agent
    source: user agents (~/.claude/agents)
    used_by: [fhir-storage-search-engineer]
  - name: deep-research
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: deployment-patterns
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-infra-release-engineer]
  - name: docker-patterns
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-infra-release-engineer]
  - name: documentation-and-adrs
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-architect]
  - name: e2e-testing
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-test-engineer]
  - name: firecrawl-search
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-architect]
  - name: github-ops
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-infra-release-engineer]
  - name: gitops-bootstrap
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-infra-release-engineer]
  - name: go-build-resolver
    kind: agent
    source: user agents (~/.claude/agents)
    used_by: [fhir-go-developer]
  - name: golang-patterns
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-go-developer, fhir-storage-search-engineer]
  - name: golang-testing
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-go-developer, fhir-storage-search-engineer, fhir-test-engineer]
  - name: healthcare-phi-compliance
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-security-compliance-reviewer]
  - name: healthcare-reviewer
    kind: agent
    source: user agents (~/.claude/agents)
    used_by: [fhir-security-compliance-reviewer]
  - name: hipaa-compliance
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-security-compliance-reviewer]
  - name: idea-refine
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-architect]
  - name: karpathy-progress-memory
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-analyze
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: kbd-apply
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-go-developer, fhir-storage-search-engineer, fhir-tech-lead]
  - name: kbd-assess
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: kbd-execute
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-goal
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: kbd-goal-check
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-conformance-validator, fhir-tech-lead]
  - name: kbd-memory-recall
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-new-phase
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: kbd-next-phase
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-plan
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: kbd-process-orchestrator
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-reflect
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: kbd-status
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: knowledge-ops
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-tech-lead]
  - name: kustomize-overlay
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-infra-release-engineer]
  - name: llm-wiki
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: postgres-patterns
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-architect, fhir-storage-search-engineer]
  - name: security-and-hardening
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-security-compliance-reviewer]
  - name: security-review
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-security-compliance-reviewer]
  - name: security-reviewer
    kind: agent
    source: user agents (~/.claude/agents)
    used_by: [fhir-security-compliance-reviewer]
  - name: shipping-and-launch
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-infra-release-engineer]
  - name: superpowers:brainstorming
    kind: skill
    source: superpowers plugin (Claude Code plugin marketplace)
    used_by: [fhir-architect]
  - name: superpowers:verification-before-completion
    kind: skill
    source: superpowers plugin (Claude Code plugin marketplace)
    used_by: [fhir-conformance-validator]
  - name: surgical-patch
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-go-developer]
  - name: tdd-workflow
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-go-developer, fhir-test-engineer]
  - name: test-driven-development
    kind: skill
    source: shared agent skills (~/.TOOLS/skills/agents, linked into ~/.claude/skills)
    used_by: [fhir-test-engineer]
  - name: validate-idea
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-architect]
  - name: verification-loop
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-conformance-validator, fhir-test-engineer]
  - name: agent-team-creator
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin; public Prometheus-AGS/prometheus-skill-system, MIT); validates and exports .agent-team/team.json (build-manifest --check and CI also run it)
    used_by: [fhir-architect, fhir-infra-release-engineer]
  - name: healthcare-phi-compliance
    kind: skill
    source: everything-claude-code (MIT, affaan-m/everything-claude-code), machine-local
    used_by: [hipaa-privacy-officer, fhir-security-compliance-reviewer]
  - name: hipaa-compliance
    kind: skill
    source: everything-claude-code (MIT, affaan-m/everything-claude-code), machine-local
    used_by: [hipaa-privacy-officer, fhir-security-compliance-reviewer]
  - name: prior-auth
    kind: plugin-skill
    source: healthcare@healthcare Claude Code plugin (anthropics/healthcare, not vendored; marketplace registered in .claude/settings.json, plugin per-user opt-in, synthetic lane only — ATH-D-007)
    used_by: [billing-prior-auth-specialist]
  - name: procedure-coding
    kind: plugin-skill
    source: healthcare@healthcare Claude Code plugin (anthropics/healthcare)
    used_by: [billing-prior-auth-specialist]
  - name: icd10-cm
    kind: plugin-skill
    source: healthcare@healthcare Claude Code plugin (anthropics/healthcare)
    used_by: [billing-prior-auth-specialist]
  - name: fhir-developer
    kind: plugin-skill
    source: healthcare@healthcare Claude Code plugin (anthropics/healthcare)
    used_by: [fhir-integration-specialist]
```

Runtime tools:
- **Node.js 24+** on PATH, for all hooks (exec form `node <script>`).
- **Go 1.25+** and `gofmt`: `gofmt-check` is silent when gofmt is absent.
- **Docker**, for integration tests.
- **`pk`** (Prometheus knowledge CLI) and **Python 3** (`python3`, `python` or `py -3`) with `~/.claude/skills/karpathy-progress-memory`, for Karpathy knowledge-base delivery and KBD boundary records. Each degrades to the `.prometheus/outbox/` queue or a `boundary_degraded` ledger line when absent.
- **Git Bash** on Windows, for the KBD stage hooks. The KBD orchestrator's dispatcher is a bash library (decision D-005); the Claude Code hooks in this repo need only Node.
