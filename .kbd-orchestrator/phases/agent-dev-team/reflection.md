# Phase Reflection: agent-dev-team

**Project:** WSO2 FHIR Server
**Date:** 2026-09-24
**Phase completion:** 100% implementation (8/8). Certification: security gate PASS; lint green in CI (not runnable locally).
**Changes completed:** 8 / 8
**Branch / PR:** `feat/agent-dev-team` (a171d40, e0987cf, 8ebfaa3) → draft PR https://github.com/GQAdonis/fhir-server/pull/1. All checks green on ubuntu, macOS and Windows.

## Deltas from plan (what diverged, and why)

1. **Review cost was about 3× the plan.**
   - The 8 changes needed 38 cross-model diff-review rounds in total. That is a median of 3.5 per change, with a maximum of 11 (`add-infra-and-knowledge-agents`), against an implicit expectation of 1–2.
   - Roughly half of the CRITICAL findings (63 in total) were **packet-scope artifacts**, not defects: per-change `files.txt` hid files owned by earlier changes; `build-review-packet.sh` diffs only against `HEAD` and prunes `*/.git*`, which also hides `.github/`; the judge saw a filesystem tree with no git ignore state.
   - *Root cause:* per-change review packets over a shared, cumulative package.
   - *Corrective action:* review the cumulative candidate (`git diff <base>...HEAD` for the phase), and add a base-ref option plus correct `.github` handling to the adversarial-review skill.
2. **Real defects the reviews caught** (each fixed, with a regression test):
   - **Privacy:**
     - the ledger sanitizer allowed `@`, `/` and `+`, so DSNs and emails could pass through identifier fields;
     - allowlisted values were printed into scan output;
     - the allowlist could whitelist real data;
     - the scanner ignored `.gitignore` scope.
   - **Security:** a relative-path bypass of the generated-file guard (`../repo/internal/basedef/x.gz`).
   - **Data integrity:**
     - the flush cursor advanced before the note was persisted, so a failed write lost ledger lines;
     - same-instant notes overwrote each other;
     - the note write was not atomic.
   - **Correctness:** a loose license-header check, a temp-dir leak in `check-dist`, and lint gaps (tool both granted and disallowed; list-valued scalars; path-like skill names).
   - **Portability:** Windows CRLF broke `lint-agents` and the gofmt test. The first remote CI run caught it, not local review, because local runs were macOS-only.
3. **Plan assumptions that did not hold:**
   - *KBD per-hook override.* The plan assumed the KBD `hooks-config.json` could override a built-in hook by id. It can only suppress the default reporter. Switched to augment entries (D-005).
   - *`pk ingest` latency.* It measured about 12 s, over the 10 s synchronous cap, so delivery was redesigned to be asynchronous with a detached drainer.
   - *Agent visibility.* A running Claude session does not see agents created mid-session, so smoke tests used headless `claude -p --agent`.
   - *Preloading.* `skills:` preload cannot degrade when a skill is missing, so a rule was adopted: preload only repo-resident skills.
4. **Operator decisions changed during execution.**
   - The "commit everything" choice for `.prometheus/` (D-003) was amended after the security persona found that the user-level `pk` Stop hook writes assistant reply text into `knowledge/wiki/`. The fix was to gitignore reply text (D-006) and drop the prompt hash (D-007).
   - The producing session had flagged this only as an "open item" in the ledger change's resolution and did not act on it. It was resolved only after the first real use of `fhir-security-compliance-reviewer` BLOCKED on it.
5. **Environment friction:**
   - A stale `.git/index.lock` appeared twice, left by headless sessions, and silently blocked `git add -N`, once hidden by `2>/dev/null`.
   - `golangci-lint` is absent locally.
   - Headless persona sessions could not run commands needing approval until `--allowedTools` was passed.

## Goals

The verdicts below come from an independent evaluator (`fhir-conformance-validator`, `evidence/goal-check.txt`), with its residual gaps closed in `evidence/goal-check-gap-closure.txt`.

| Goal | Status | Evidence |
|---|---|---|
| G1 Analyze codebase, CI and agent/skill inventory | MET | `assessment.md`; `evidence/assess-evidence.txt` (50/50 assigned skills resolved; 43 machine-local) |
| G2 Define agents with model, tools and responsibilities across the lifecycle | MET | 11 `.claude/agents/fhir-*.md`; `lint:agents` OK; fresh-session listing and role checks for all 11 (`evidence/change8-team-acceptance.txt`) |
| G3 Map personas to KBD and supporting skills, with hand-offs | MET | `docs/agent-team.md` matrix and hand-off diagram; prerequisites block enforced by `lint:agents` |
| G4 Encode the fhir-server domain rules | MET | storage persona cites all store/db constraints (`refinement_log`); a seeded fail-closed violation → CRITICAL/BLOCK (`evidence/smoke-quality-agents.txt`); guard, header and gofmt hooks live-verified |
| G5 Document the team and verify agents load | MET | `docs/agent-team.md`, `CLAUDE.md` Agent-team section, team acceptance evidence |
| C1 TypeScript 7 → Node `.mjs`, cross-platform, no shell | MET | `typescript@7.0.2`; exec-form registrations only; `agent-tooling.yml` green on linux, darwin and win32 (`evidence/change8-ci-remote.txt`) |
| C2 Karpathy skills log everything | MET, with a caveat | Ledger, flush and boundary hooks are live (114 ledger lines, 34 boundary records, 32 knowledge-base ingests). **Caveat:** "everything" is bounded by design to metadata (D-003/D-006/D-007). Subagent start/stop coverage is uneven; see Karpathy lessons. |

## Delivered Changes

All were executed by the Claude Code main session (Opus 5.5) through `/kbd-apply`, and are archived under `openspec/changes/archive/2026-09-24-*`. Review rounds are given as rounds / CRITICAL findings.

- `add-hooks-typescript-toolchain`: TypeScript 7 build, `hook-io`/`paths` libraries, `check:dist`, `settings.json`, license-header unblock. Review: 2 / 3.
- `add-architecture-agents`: tech-lead, ideation-strategist and architect agents; vendored `karpathy-guidelines`. Review: 3 / 7.
- `add-karpathy-agent-ledger`: ledger, flush with async `pk`, boundary bridge, scanner. Review: 4 / 8, plus 2 security-persona rounds.
- `add-guardrail-hooks`: session-context, guard-generated, license-header and gofmt-check hooks. Review: 4 / 4.
- `add-engineering-agents`: go-developer, storage-search-engineer and test-engineer agents; `docs/agent-team.md` prerequisites. Review: 3 / 6.
- `add-quality-agents`: code-reviewer, security-compliance-reviewer and conformance-validator agents; lint-blocking policy. Review: 4 / 6.
- `add-infra-and-knowledge-agents`: infra-release-engineer and knowledge-curator agents, plus scanner and flush hardening. Review: 11 / 17.
- `document-and-verify-agent-team`: full docs, `lint:agents`, the 3-OS workflow, `model_policy`. Review: 7 / 12.

## Artifact Quality Summary

| Metric | Value |
|---|---|
| Changes with QA | 8/8 |
| Constraint checks (refine-validate) first-pass pass rate | 8/8 (100%): 66 checks, 0 FAIL |
| Adversarial diff-review first-pass pass rate | 0/8 (0%) |
| Total diff-review rounds | 38 (plus 2 assess and 2 plan artifact rounds) |
| CRITICAL findings raised / real defects | 63 / about 30. The rest were packet-scope artifacts or stale judge knowledge (e.g. "TypeScript 7.0.2 unpublished") |
| Persona gates | security PASS (2 rounds), code-review PASS, conformance goal check PASS |
| Hook test suite | 11 → 89 tests, 0 failures |

### Recurring review findings (2+ changes)

- **Packet scope / files missing from the diff:** 6 changes. This is a process issue, not a code issue.
- **Acceptance criteria drifting from implementation** (task text written before a later rule): 4 changes. Examples are the skill-preload rule, lint gating, and read-only semantics.
- **`.prometheus/` privacy hardening:** 3 changes (ledger, infra/knowledge, docs).

## Technical Debt

- `.github/workflows/release.yml`: tag-pinned `actions/checkout@v4` and `actions/setup-go@v5`, where the rest of CI pins by SHA. Owner: `fhir-infra-release-engineer`.
- `.gitignore`: `./fhir-server` (the `make build` output) is not ignored. Owner: `fhir-infra-release-engineer`.
- `.prometheus/session-log.md` is about 720 KB. The machine-level `record-progress.py` lists gitignored `node_modules` paths in `touchedFiles`. This is upstream in the global skill, not in this repo.
- `.kbd-orchestrator/project.json`: absolute local paths (`focus_project_path`, workspace folder) generated by `kbd-init`, which are non-portable for other contributors.
- The `karpathy-flush` hook writes a knowledge-base note for every `Stop`, including 2–3-line no-change windows, which floods the project knowledge base with near-duplicate "activity" entries (see the pk context). It needs a minimum-delta threshold.
- The adversarial-review skill (global) needs a base-ref diff option, must not prune `.github/`, and should expose git ignore state in its file tree.
- KBD stage hooks (the global orchestrator) still need Git Bash on Windows (D-005).
- `fhir-security-compliance-reviewer` and the other headless personas need `--allowedTools` to run their gate commands non-interactively. The pattern is documented only in evidence files, not in `docs/agent-team.md`.

## Architecture Integrity

- AGENTS.md violations: N/A (no `AGENTS.md`).
- Constraint violations: **none open**.
  - One pre-existing `license-header` violation was fixed (`internal/config/example_parse_test.go`).
  - `golangci-lint-clean` was verified in CI only (green on `e0987cf` and `8ebfaa3`).
  - No Go production code changed, so the `search-fail-closed`, `rls-tenant-scope`, `no-gin-on-resource-json` and store race constraints were untouched.

## Cross-Tool Coordination Notes

- **Progress tracking: RELIABLE, with two gaps.**
  - The `kbd-apply` begin/end driver and the `prometheus kbd` typed transitions kept 8/8 and 44 tasks consistent. Karpathy boundary records fired on every task and change.
  - Gap 1: `exactNextCommand` stays stale unless explicitly revised, which the skill already warns about.
  - Gap 2: the waypoint Markdown projection does not exist, even though skills reference it.
- **Handoff quality: CLEAR** for stage handoffs (`handoffs/*.json`).
- **Persona handoffs worked when explicit.** For example, the security persona routed two policy questions to the operator instead of deciding them.
- **Multi-tool:** OpenSpec skills for Codex, OpenCode, Kimi, Zed and MiniMax are installed, but no other tool executed a change this phase. The cross-tool protocol was not exercised.
- **Recommendations:**
  - Build cumulative review packets.
  - Pass `--allowedTools` when dispatching read-only personas headless.
  - Never `2>/dev/null` a `git add`.
  - Check for a stale `index.lock` after headless sessions end.

## Karpathy lessons (from `fhir-knowledge-curator`)

**Source:** `fhir-knowledge-curator` (Haiku 4.5, fresh session, read-only), full output in `evidence/curator-lessons.txt`, window 12:40–22:42Z. The orchestrator checked each diagnosis against the design and the ledger (maker ≠ evaluator applies in both directions); corrections are marked **[verified]**.

**Health signals** (ledger, 114+ lines):
- **Boundaries:** 34 `boundary_recorded` (28 task, 6 change), 0 `boundary_degraded`.
- **Knowledge base:** 32 `kb_ingested`, 0 `kb_deferred`, outbox empty.
- **Flush:** 0 `flush_blocked`.
- **Tool failures:** 7 `PostToolUseFailure` (Bash 5, Read 2), all in headless persona sessions.
- **Subagents:** 1 `Explore` start/stop pair, plus 7 `SubagentStop` with empty `agent_type`.
- **Scan:** clean (129 committable files).

**Lessons:**
1. **Pre-review discipline.** Most real defects (privacy, atomicity, CRLF, persona scope) were found only by the adversarial gate. Add a domain pre-review checklist (concurrency, data classification, OS matrix, persona write scope) to future hook and agent task templates. Owner: `fhir-architect`, which authors tasks. **[verified]**
2. **Persona tool failures are approval denials, not transient errors.** The curator proposed retries and backoff. **[verified: wrong root cause]** The failures are in headless sessions (`0a1821b6` security review, `58cbf9e4` goal check, `69d3c443` branch review), where gate commands such as `scan:prometheus`, `go` and `openspec` were denied without `--allowedTools`; the personas said so in their own reports. Fix: document a standard `--allowedTools` set per read-only persona in `docs/agent-team.md`. Owner: `fhir-tech-lead`.
3. **Every boundary shows `duplicate`.** The curator read this as broken duplicate detection. **[verified: expected by design, D-005]** On Unix the built-in python entry records first, and the Node augment entry then hits the idempotent recorder, which returns `duplicate`. The real gap is that the ledger only sees the second call, so it cannot distinguish "recorded by builtin" from "never recorded". Fix: the Node bridge logs `recorded-by-builtin` when it gets `duplicate` right after a same-identity boundary, or it reads the receipt. Owner: `fhir-knowledge-curator` plus the hook maintainer.
4. **Knowledge-base delivery works but is not measured.** 32 of 32 were delivered. Add time-to-delivery to `kb_ingested` outcomes. **[verified; correction: `pk-drain` is a detached process started per flush, not a timer]** Separately, and more important: flush writes a note for every Stop, even 2–3-line no-change windows, flooding the knowledge base with near-duplicate "activity" entries. Needs a minimum-delta threshold. Owner: `fhir-knowledge-curator`.
5. **Unmatched `SubagentStop` events are internal agents.** The curator attributed them to phase filtering. **[verified: wrong; the ledger is not filtered]** All 7 unmatched stops have an empty `agent_type`, which the Claude Code hooks reference defines as internal agents. Label them `internal`, and exclude them from the persona start/stop balance. Owner: hook maintainer.
6. **Scanner hardening held.** Allowlist-exact, synthetic-only, count-not-values, committable scope. Document the rule next to decisions D-003/D-006/D-007 in `scan-prometheus.mts`. Owner: `fhir-security-compliance-reviewer`. **[verified]**
7. **Review packets must be cumulative.** This is the base-ref option plus not pruning `.github/`. Owner: `fhir-tech-lead` (upstream skill). **[verified; `.gitattributes` LF pins for `*.go`, agent files and the team doc are already in place]**

**Meta-lesson.** The Haiku curator computed signals correctly, but it misattributed 3 of 7 root causes by reasoning past the design docs. Either give it `docs/agent-team.md` and the karpathy-logging spec as required reading, or move root-cause analysis to a sonnet-class pass and keep Haiku for counting.


## Lessons Learned

- Review the *cumulative* candidate, not per-change slices, when changes share a package. Per-change slicing was the largest single source of wasted rounds.
- Write acceptance criteria after cross-cutting rules are settled, or amend every open change's `tasks.md` the moment a rule changes. Stale criteria produced about 10 CRITICAL findings.
- An independent persona reviewer found a privacy issue (reply text headed for a commit) that the producing session had rationalized away in two self-reviews. Dispatch persona reviewers early, not only at the gate.
- Measure external latencies (`pk ingest` ≈ 12 s) before choosing synchronous or asynchronous; the plan guessed wrong.
- Local verification on one OS is not cross-platform evidence. CRLF broke Windows on the first real run.
- Project agents load at session start, so agent smoke tests must use fresh headless sessions.
- Preload only repo-resident skills. Machine-local skills belong in a documented prerequisites list that lint enforces.

## Next Phase Focus

**Recommended next phase: `agent-team-hardening`.** Top priorities:
1. **Karpathy signal quality:**
   - a minimum-delta threshold for flush notes;
   - fix the SubagentStart/Stop imbalance, or document it;
   - dedupe or prune the "activity" entries in the knowledge base;
   - a monthly ledger rotation check.
2. **CI and supply-chain debt:** SHA-pin `release.yml`; gitignore `./fhir-server`; add a `.prometheus/` scan as a pre-commit guard, not only in CI.
3. **First real feature phase dogfooding the team.** Pick one FHIR gap (for example, the reindex non-goal, issue #11, or a FHIR262 conformance failure) through `fhir-ideation-strategist` → `fhir-architect` → engineering personas, to measure whether the team reduces rework versus this phase.

**Needs a human decision before proceeding:**
- Whether to upstream any of this to `wso2/fhir-server` (currently on the fork only).
- Whether the committed `.prometheus/` volume is acceptable, or whether raw notes should be ignored too. It is 1.8 MB across 117 files after this single phase day, of which about 720 KB is `session-log.md`.

## Context for Next Phase

Use this file as prior context for the next `/kbd-assess` invocation. The key evidence index is `.kbd-orchestrator/phases/agent-dev-team/evidence/`, and the review resolutions are `review/*/resolution.md`.
