# Agent team

The WSO2 FHIR Server ships a team of eleven Claude Code subagents (`.claude/agents/fhir-*.md`) and a set of cross-platform hooks (`.claude/hooks/`). Together they run the KBD lifecycle (assess → plan → execute → reflect) with OpenSpec changes as the unit of work. Every agent is prefixed `fhir-`, so none silently replaces a user-level agent of the same name (decision D-001).

Start a session led by the tech lead:

```bash
claude --agent fhir-tech-lead
```

Any session can also delegate to a persona by name, for example "use fhir-storage-search-engineer for this". Project agents load at session start, so start a new session after adding or editing an agent file.

## Roster

| Agent | Lifecycle role | Model | Why this model | Tools |
|---|---|---|---|---|
| `fhir-tech-lead` | Orchestrates KBD, routes work, runs the QA gate before archive | opus | Cross-cutting judgement on sequencing, persona routing and gate decisions; a routing mistake is expensive downstream | Agent, read/inspect, Bash for KBD, OpenSpec and verify commands (Edit/Write disallowed) |
| `fhir-ideation-strategist` | Feature discovery, FHIR/IG research, phase goals | opus | Open-ended research and synthesis across the spec, the code and the web | Read-only + web search/fetch + Firecrawl |
| `fhir-architect` | Assess, analyze, plan; OpenSpec authoring; `DESIGN.md` steward | opus | Plan quality sets the scope and cost of every later change | Read + writes limited to design artifacts |
| `fhir-go-developer` | Implementation outside the storage core | sonnet | Well-specified, test-first tasks; runs in an isolated worktree | Full edit + Bash |
| `fhir-storage-search-engineer` | Store, search, index, schema, RLS | opus (effort high) | The correctness core: fail-closed search, tenancy and SQL mistakes are data-safety bugs | Full edit + Bash |
| `fhir-test-engineer` | Unit, integration, race, conformance, golden tests | sonnet | Convention-heavy test work against the CI parity commands | Full edit + Bash |
| `fhir-code-reviewer` | Diff review against project rules and constraints | sonnet | Checklist-driven review with evidence citation | Read-only + verify commands |
| `fhir-security-compliance-reviewer` | PHI/HIPAA, tenant isolation, injection, secrets, `.prometheus/` | opus | Healthcare data and multi-tenant isolation need the deepest adversarial reasoning | Read-only + verify commands |
| `fhir-conformance-validator` | Final archive gate; `/kbd-goal-check` | sonnet | Mechanical: runs the required commands and maps spec scenarios to evidence | Read-only + verify commands |
| `fhir-infra-release-engineer` | GitHub Actions, Helm, Docker, releases | sonnet | Bounded, parity-driven pipeline edits | Edit limited to CI and deploy assets |
| `fhir-knowledge-curator` | Karpathy loop: ledger → lessons → knowledge base | haiku | Frequent, low-risk summarization over metadata | Writes limited to `.prometheus/` and the reflection lessons section |

The model mix is 5 opus, 5 sonnet and 1 haiku (decision D-002). Opus is reserved for orchestration, research, architecture, the storage core and security review. Models are the current family: Opus 5.5, Sonnet 5, Haiku 4.5.

## Persona → KBD stage and skill matrix

Preloaded skills are always repo-resident (see [Prerequisites](#prerequisites)). "Invoke" skills are machine-local.

| Agent | KBD stages / commands owned | Preloaded skills | Invoke when needed |
|---|---|---|---|
| `fhir-tech-lead` | `/kbd-execute`, `/kbd-status`, `/kbd-goal-check`, `/kbd-next-phase`, `/kbd-apply` dispatch | karpathy-guidelines | kbd-process-orchestrator, kbd-status, kbd-execute, kbd-apply, kbd-goal-check, kbd-next-phase, kbd-reflect, adversarial-review |
| `fhir-ideation-strategist` | `/kbd-new-phase` and `/kbd-goal` drafting | karpathy-guidelines, openspec-explore | idea-refine, superpowers:brainstorming, validate-idea, kbd-goal, kbd-new-phase, deep-research, firecrawl-search |
| `fhir-architect` | `/kbd-assess`, `/kbd-analyze`, `/kbd-plan`, `/opsx:new/ff/continue/update` | karpathy-guidelines, openspec-propose | kbd-assess, kbd-analyze, kbd-plan, openspec-*, documentation-and-adrs, api-design, postgres-patterns, adversarial-review |
| `fhir-go-developer` | `/kbd-apply` tasks (non-storage packages) | karpathy-guidelines, openspec-apply-change | kbd-apply, golang-patterns, golang-testing, tdd-workflow, surgical-patch, go-build-resolver (agent) |
| `fhir-storage-search-engineer` | `/kbd-apply` tasks (store, index, db, searchparam) | karpathy-guidelines, openspec-apply-change | kbd-apply, postgres-patterns, database-migrations, golang-patterns, golang-testing, database-reviewer (agent) |
| `fhir-test-engineer` | Test plans; CI-parity test runs | karpathy-guidelines, openspec-verify-change | golang-testing, test-driven-development, tdd-workflow, verification-loop, e2e-testing |
| `fhir-code-reviewer` | Code-review gate | karpathy-guidelines | code-review-and-quality, adversarial-review |
| `fhir-security-compliance-reviewer` | Security gate for sensitive paths | karpathy-guidelines | security-review, hipaa-compliance, healthcare-phi-compliance, security-and-hardening, healthcare-reviewer / security-reviewer (agents) |
| `fhir-conformance-validator` | Archive gate (`kbd-apply verify`, `/opsx:verify`), `/kbd-goal-check` | karpathy-guidelines | openspec-verify-change (read-only steps), kbd-goal-check, verification-loop, superpowers:verification-before-completion |
| `fhir-infra-release-engineer` | CI/CD and release changes | karpathy-guidelines | ci-cd-and-automation, github-ops, deployment-patterns, docker-patterns, shipping-and-launch, gitops-bootstrap, kustomize-overlay |
| `fhir-knowledge-curator` | Karpathy lessons for `/kbd-reflect` | karpathy-guidelines | karpathy-progress-memory, kbd-reflect, kbd-memory-recall, llm-wiki, continuous-learning-v2, knowledge-ops |

## Hand-offs

```
fhir-ideation-strategist ──goals──▶ fhir-tech-lead ──/kbd-new-phase──▶ fhir-architect
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
fhir-knowledge-curator ◀── phase end: ledger → Karpathy lessons → /kbd-reflect
```

- **Gate rules.** Any CRITICAL finding from a reviewer means BLOCK. For Go changes, archive requires either a local `make lint` pass or recorded evidence of a green CI lint job; unverified lint means BLOCK. Commits and pushes happen only when the operator asks.
- **Read-only personas** (`fhir-tech-lead`, the reviewers and the validator) never modify tracked files. Their Bash use is limited to verification. Commands that write into the repo (`make build`, `npm run build`) are not allowed for them.

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
fhir-knowledge-curator ──phase end──▶ Karpathy lessons in reflection.md
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

The agents preload only skills that live in this repository: the vendored `karpathy-guidelines` and the OpenSpec skills installed by `openspec init`. So every agent loads on a fresh clone.

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
    used_by: [fhir-knowledge-curator]
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
    used_by: [fhir-ideation-strategist]
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
    used_by: [fhir-ideation-strategist]
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
    used_by: [fhir-ideation-strategist]
  - name: karpathy-progress-memory
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-knowledge-curator]
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
    used_by: [fhir-ideation-strategist]
  - name: kbd-goal-check
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-conformance-validator, fhir-tech-lead]
  - name: kbd-memory-recall
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-knowledge-curator]
  - name: kbd-new-phase
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-ideation-strategist]
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
    used_by: [fhir-knowledge-curator, fhir-tech-lead]
  - name: kbd-status
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-tech-lead]
  - name: knowledge-ops
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-knowledge-curator]
  - name: kustomize-overlay
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-infra-release-engineer]
  - name: llm-wiki
    kind: skill
    source: prometheus-skill-pack (Prometheus plugin)
    used_by: [fhir-knowledge-curator]
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
    used_by: [fhir-ideation-strategist]
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
    used_by: [fhir-ideation-strategist]
  - name: verification-loop
    kind: skill
    source: Claude skills collection (~/.TOOLS/skills/claude, linked into ~/.claude/skills)
    used_by: [fhir-conformance-validator, fhir-test-engineer]
```

Runtime tools:
- **Node.js 24+** on PATH, for all hooks (exec form `node <script>`).
- **Go 1.25+** and `gofmt`: `gofmt-check` is silent when gofmt is absent.
- **Docker**, for integration tests.
- **`pk`** (Prometheus knowledge CLI) and **Python 3** (`python3`, `python` or `py -3`) with `~/.claude/skills/karpathy-progress-memory`, for Karpathy knowledge-base delivery and KBD boundary records. Each degrades to the `.prometheus/outbox/` queue or a `boundary_degraded` ledger line when absent.
- **Git Bash** on Windows, for the KBD stage hooks. The KBD orchestrator's dispatcher is a bash library (decision D-005); the Claude Code hooks in this repo need only Node.
