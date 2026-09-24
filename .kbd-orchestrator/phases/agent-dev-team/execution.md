EXECUTION: agent-dev-team
Project: WSO2 FHIR Server
Date: 2026-09-24
Selected backend: openspec
Dispatched to: SELF (Claude Code main session). Each change is driven task-by-task through `/kbd-apply`.
Backend rationale: `openspec/` and the CLI are present. All 8 changes have strict-valid proposal, spec and tasks artifacts, which gives spec-backed traceability. The `fhir-*` personas are this phase's *output*, so they can't be the execution backend until their changes land. From round 3 onward, the review and validation personas (changes 6 and 4) are dogfooded as the QA reviewers.
Backend entrypoint: `/kbd-apply <change-id>`, which wraps `~/.claude/skills/kbd-apply/kbd-apply.sh begin-task|end-task|verify|archive`. Never use bare `/opsx:apply`.
OpenSpec available: YES
Source plan: .kbd-orchestrator/phases/agent-dev-team/plan.md

EXECUTION SCOPE

- add-hooks-typescript-toolchain: TS7 → Node `.mjs` hook toolchain, runtime library, settings skeleton, license-header unblock (7 tasks)
- add-architecture-agents: fhir-tech-lead, fhir-ideation-strategist, fhir-architect, and vendored karpathy-guidelines (5 tasks)
- add-karpathy-agent-ledger: metadata-only ledger, flush to pk, KBD boundary bridge, PHI/secret scanner (8 tasks)
- add-guardrail-hooks: session-context, guard-generated, license-header, gofmt-check (5 tasks)
- add-engineering-agents: fhir-go-developer, fhir-storage-search-engineer, fhir-test-engineer (5 tasks)
- add-quality-agents: fhir-code-reviewer, fhir-security-compliance-reviewer, fhir-conformance-validator (5 tasks)
- add-infra-and-knowledge-agents: fhir-infra-release-engineer, fhir-knowledge-curator (3 tasks)
- document-and-verify-agent-team: docs, model_policy alignment, lint-agents, 3-OS CI, team acceptance (6 tasks)

The runtime has 44 tasks registered.

DISPATCH CONTRACTS

The model registry in `project.json` still holds template defaults. That is fixed by change 8, task 1.2. Until then, concrete models come from the current Claude family.

| Round | Change | Model class | Concrete model | Model rationale |
|---|---|---|---|---|
| 1 | add-hooks-typescript-toolchain | medium | sonnet (Sonnet 5) | 7 tasks, one new module, no open design markers |
| 1 | add-architecture-agents | medium | sonnet (Sonnet 5) | Markdown agents from a fixed skeleton; the opus agents are *defined* here, not required to write them |
| 2 | add-karpathy-agent-ledger | frontier | opus (Opus 5.5) | 8 tasks spanning the Claude-hook, KBD-hook and pk boundaries, with a privacy guarantee for committed logs |
| 2 | add-guardrail-hooks | medium | sonnet (Sonnet 5) | 5 tasks following the change 1 patterns |
| 2 | add-engineering-agents | medium | sonnet (Sonnet 5) | Domain-rule encoding, checked by smoke prompts |
| 2 | add-quality-agents | medium | sonnet (Sonnet 5) | Read-only agents with a seeded-diff smoke test |
| 3 | add-infra-and-knowledge-agents | small | haiku (Haiku 4.5) | 3 tasks, markdown only, direct analogs |
| 4 | document-and-verify-agent-team | medium | sonnet (Sonnet 5) | Doc plus lint plus CI workflow |

This session runs on Opus 5.5, which covers every class. The table records the cheapest viable model for any external re-dispatch (prom-lanes / UAR / Codex).

Every contract uses these entry and handoff rules:
- Entry: `/kbd-apply <change-id>`. Walk the tasks in `tasks.md` order; each task's own verify clause must pass before `end-task`.
- Progress file: `.kbd-orchestrator/phases/agent-dev-team/progress.json`. It is written by the runtime; never hand-edit it.
- Handoff:
  - `end-task` syncs progress.
  - On the last task, run the QA gate below, then `kbd-apply verify` and `kbd-apply archive`.
  - Commit on a feature branch (`feat/agent-dev-team`), never directly on `main`.

HANDOFF NOTE for any non-self tool (Codex / OpenCode / Kimi / MiniMax via their installed OpenSpec skills):
1. Read `.kbd-orchestrator/position-reminder.txt`, then `current-waypoint.json` `.nextChange`. Never use `exactNextCommand`.
2. Read `openspec/changes/<change-id>/{proposal,design,tasks}.md` and `specs/**`.
3. On start: `prometheus kbd change transition --phase agent-dev-team --id <change-id> --status in-progress`.
4. Per task: `prometheus kbd task transition … --status complete` after its verify clause passes, and tick the box in `tasks.md`.
5. On blocker: `prometheus kbd blocker record …`, and stop.

APPROVAL GATES

- Before the first commit and before any push: operator approval is required (repo policy: commit and push only when asked).
- Change 2, before `.prometheus/` content is committed: `scan:prometheus` must exit 0, and the security-compliance review must PASS once change 6 exists. If change 6 does not exist yet, change 2 is held at certification PENDING.
- Change 8, task 3.1: pushing a branch to run the 3-OS workflow is an outward-facing action and needs operator confirmation.

PER-CHANGE QA GATE

1. `/refine-validate <change-id>` against `.kbd-orchestrator/constraints.md`.
2. `/adversarial-review --mode diff <change-id>`. The judge is gpt-5.5 over the REST gateway; the producer is claude-opus-5-5.
3. From round 3 onward, `fhir-code-reviewer` and `fhir-conformance-validator` (and `fhir-security-compliance-reviewer` for changes 2 and 8) also run as persona reviewers.
4. PASS: `kbd-apply verify`, then `kbd-apply archive`. BLOCK: record certification BLOCKED, fix, and re-run steps 1–3.

FALLBACK CONDITIONS

- The `kbd-apply.sh` driver fails to parse `tasks.md`: walk the tasks manually with `prometheus kbd task transition`, and record why in this file.
- The adversarial gateway is unreachable (exit 3): use a harness-native fresh-context subagent judge, recorded as `isolation_mode: harness-native`.
- No judge at all (exit 4): write a `pending_review` receipt. Development may continue; certification may not.
- TypeScript 7.0.2 emit breaks nodenext `.mts` → `.mjs`: record a DECISION in change 1's design and pin `@typescript/native-preview` at the matching 7.0 build.

VERIFICATION REQUIREMENTS

- Every change: `openspec validate <id> --strict`, plus each task's own verify clause.
- Hook changes (1, 2, 3, 8): `npm --prefix .claude/hooks ci && npm --prefix .claude/hooks run build && npm --prefix .claude/hooks test && npm --prefix .claude/hooks run check:dist`.
- Change 1 also runs `make build && make vet && make test` (it touches a `.go` file).
- Agent changes (4–7): frontmatter parse plus the smoke prompts in `tasks.md`. From change 8 onward, also `npm --prefix .claude/hooks run lint:agents`.
- Change 2 and later: `npm --prefix .claude/hooks run scan:prometheus`.

PROGRESS LEDGER

- [PENDING] add-hooks-typescript-toolchain: SELF (round 1)
- [PENDING] add-architecture-agents: SELF (round 1)
- [PENDING] add-karpathy-agent-ledger: SELF (round 2)
- [PENDING] add-guardrail-hooks: SELF (round 2)
- [PENDING] add-engineering-agents: SELF (round 2)
- [PENDING] add-quality-agents: SELF (round 2)
- [PENDING] add-infra-and-knowledge-agents: SELF (round 3)
- [PENDING] document-and-verify-agent-team: SELF (round 4)

OUTPUTS

- `openspec/changes/<8 ids>/`, with proposal, specs and tasks for each, plus design for 1, 2, 3, 4 and 8. All pass `openspec validate --strict`.
- 44 canonical tasks registered with `prometheus kbd task register`.

BLOCKERS

- NONE for starting. Known non-blocking gap: `golangci-lint` is not installed locally, so the `golangci-lint-clean` constraint can only be verified in CI.

REFLECTION HANDOFF

- The per-change adversarial findings (`review/<change-id>/findings.json`) and persona-review verdicts.
- Ledger volume and any `flush_blocked` / `boundary_degraded` events from `.prometheus/agent-ledger.jsonl`, which measure the Karpathy loop's health.
- Whether the round-2 plan fixes (recorder resolution, pk-absent acceptance) held up in change 2.
- Actual model class used against the planned class for each change, to calibrate routing.
- The Windows CI outcome for C1.

EXECUTION READY
