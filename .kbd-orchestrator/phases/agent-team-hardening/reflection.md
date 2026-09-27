# Phase Reflection: agent-team-hardening

**Project:** WSO2 FHIR Server (Tribe Health fork)
**Date:** 2026-09-26
**Phase completion:** 93% (6 of 7 goals MET, 1 PARTIAL)
**Changes completed:** 7 / 7 (all verified and archived)

## Deltas from the plan

These are what diverged, ahead of what worked:

1. **G6 is only partly proven.** OpenCode ran 0/5 in the headless smoke test (`evidence/cross-harness-smoke.md`).
   - **Root cause:** the team's OpenCode roles are exported as subagents (`mode: "subagent"`, which `lint:agents` requires), and `opencode run --agent` accepts only primary agents. The operator's local OpenCode default model (`anthropic/claude-sonnet-4-5`) is also not found.
   - **Corrective action:** accepted by the operator as a known limitation, documented in `docs/agent-team.md`. Re-run the 5-role set from a primary-agent session once the local config is fixed.
2. **The PHI-lane controls are not yet sufficient for real PHI.** The HIPAA review deferred W1–W5:
   - W1: the lane proof is operator-declared, not read from the endpoint the harness actually calls.
   - W2: the Claude Tribe profile merges with project and user settings.
   - W3: shell egress is open.
   - W4: the harness templates are incomplete.
   - W5: FHIR detection has gaps.

   **Root cause:** the phase was synthetic-only by design, and the controls were built before any Tribe endpoint exists. **Corrective action:** a gate in `docs/compliance/README.md` blocks any real-PHI session until W1–W5 and seven more conditions hold. It becomes the next phase.
3. **The cross-model judge round budget was blown on two changes.** `define-portable-team-manifest` took 15 judge rounds and `export-team-to-harnesses` took 10, against a planned cap of two before operator escalation.
   - **Root cause:** the judge surfaced about one new CRITICAL per round rather than a complete list, and fixes were re-dispatched without a regression test. The same defect came back: `build-manifest --check` skipping `agent-team-creator validate` in rounds 11, 12 and 14, and a stale roster in `docs/agent-team.md` in rounds 7, 10 and 13.
   - **Corrective action:** see Lessons.
4. **The judge gateway was unavailable.** The liter-llm gateway (localhost:4000) returned 401 and then stopped responding. `wire-hooks-per-harness` sat un-judged until the final gate. **Corrective action:** the operator approved the Codex CLI as a fallback cross-model judge. Repairing the gateway (`/liter-llm-bridge configure`) is an open operator action.
5. **The final gate found real defects after implementation was "done".** The Codex judge's 7 CRITICAL claims, checked with failing tests first, broke down as:
   - **6 reproduced:**
     - an OpenCode subdirectory-session bypass;
     - false denies on patch-like content;
     - the Codex template's model selection;
     - a ledger rotation race;
     - wrong-agent scoping for overlapping subagents;
     - outside-repo writes allowed for the scoped agent.
   - **1 did not reproduce:** the Codex `cmd` field. It was hardened anyway after the judge pointed to `cmd` in its own session.

   The security review added 4 warnings, all fixed. Two trade-offs were accepted by the operator after the review budget was spent: hook appends never block a tool call, and agent scope fails closed when a tool call carries no agent identity.
6. **Policy changed mid-phase.** The cloud data rule was narrowed from "synthetic or de-identified" to synthetic-only. The task 5.1 grep missed "de-identification", which let the HIPAA officer's own role card contradict the decision (C1, a BLOCK) until the re-check.

## Goals

| Goal | Status | Notes |
|---|---|---|
| G1 agent-team-creator research; convert the 11 agents | MET | The creator has no healthcare area, so the manifest is expert-supplied (documented in `assessment.md`). There are 14 roles in `.agent-team/roles/`, and the merged roles are archived. |
| G2 HIPAA expert role | MET | `hipaa-privacy-officer`, exported 5x. It produced a cited review that blocked a real policy defect (C1). |
| G3 FHIR protocol and integration specialist | MET | `fhir-integration-specialist`, exported 5x, smoke-tested in 3 harnesses. |
| G4 EHR integration and data-sync business roles | MET | `ehr-integration-manager` and `data-sync-coordinator`, with `docs/integrations/` and `docs/sync/` ownership. |
| G5 billing and prior-auth specialist | MET | `billing-prior-auth-specialist` with the `payer-documentation-rules` skill. |
| G6 equivalent definitions for 5 harnesses from one source | PARTIAL | Files are generated and drift-checked for all 5 (`lint:agents`: 14 roles x 5). Behaviour was proven in Claude, Codex and Kimi (5/5 each); MiniMax by file presence only; OpenCode 0/5. |
| G7 Firecrawl skill research; cards list skills, tools and model per harness | MET | `evidence/skill-research.md`, `.agents/skills/SOURCES.json`, generated harness cards (test-enforced). |

Goal status was verified independently by `fhir-conformance-validator` (`evidence/goal-check.md`), which also re-confirmed the three round-2 plan fixes that had been applied without re-review.

## Delivered Changes

- `install-domain-skills`: healthcare skills vendored with attribution, 4 project skills, and the research record. By fhir-architect and fhir-infra-release-engineer (Claude Code).
- `define-portable-team-manifest`: `.agent-team/team.json` from role sources, with disjoint write paths, PHI-lane blocks and per-harness cards. By fhir-architect.
- `export-team-to-harnesses`: generated agents for 5 harnesses, a drift check, and `AGENTS.md` generated from `CLAUDE.md`. By fhir-infra-release-engineer.
- `retire-merged-agents`: the 2 retired personas are folded into architect and tech lead. By fhir-tech-lead.
- `wire-hooks-per-harness`: guard and ledger hooks through each harness's native mechanism, plus an allowlisted Kimi/MiniMax launcher. By fhir-infra-release-engineer.
- `configure-phi-lanes`:
  - `phi-lane-guard` and `agent-scope-guard`;
  - Tribe profiles and templates;
  - ledger rotation with an integrity check;
  - the synthetic-only policy and the compliance decision record.

  By fhir-infra-release-engineer, fhir-architect and hipaa-privacy-officer (review).
- `document-and-verify-cross-harness-team`: final docs, `project.json` harnesses, CI coverage, smoke tests and the goal check. By fhir-architect, fhir-infra-release-engineer and fhir-conformance-validator.

Outside the change list but on the branch: fixes to make agent-tooling CI pass on Windows, macOS and Ubuntu (mirror file, Windows ESM imports, dangling-symlink exports), and the rebase onto main after the docs rebrand (PR #3).

## Artifact Quality Summary

| Metric | Value |
|---|---|
| Changes with QA (refine-validate log) | 7/7 |
| QA constraint checks at final gate | all PASS, 0 FAIL recorded |
| Changes with a second QA round | 4 (install-domain-skills, define-portable-team-manifest, retire-merged-agents, wire-hooks-per-harness) |
| Cross-model judge rounds | 3, 15, 10 and 2 for the first four changes; 2 for wire-hooks-per-harness and 4 for configure-phi-lanes (initial plus verdict passes); 1 for document-and-verify |
| Changes whose first judge round was BLOCK | 7/7 |

The refine-validate logs record only passing runs, so a true first-pass QA rate cannot be computed from them. That is itself a gap: failing runs should be logged too.

### Recurring findings (judge and reviewers)

- **Docs drifting from generated sources** (roster, ownership, read-only claims): 5 rounds across 2 changes (define-portable-team-manifest rounds 7, 10, 13, 15; the document-and-verify ownership rows).
- **A check that doesn't run what it claims** (`--check` skipping `agent-team-creator validate`; `--skip-drift`; CI path filters missing a hand edit): 5 rounds across 2 changes.
- **Symlink and path handling** (installer overwrite, dangling export on Windows, ledger writes, the OpenCode session directory): 4 changes.
- **Policy wording drifting from the decision** (the de-identification allowance): 1 change, caught only by the domain reviewer.

## Technical Debt

- **Pre-real-PHI gate (W1–W5 and the conditions in `docs/compliance/README.md`):**
  - `.claude/hooks/src/lib/phi-lane.mts` `tribeLaneActive` trusts `AGENT_MODEL_BASE_URL`;
  - `.claude/settings.tribe.json` duplicates the hooks of `.claude/settings.json` by hand;
  - `*.phi.template.*` deny keys are unverified against live CLIs (Kimi and MiniMax have no denies).
- **Accepted trade-offs** in `.claude/hooks/src/lib/ledger.mts` (unlocked append after a 3 s timeout) and `.claude/hooks/src/lib/agent-scope.mts` (fails closed without a payload `agent_type`). Neither is a PHI exposure.
- **`agent-scope-guard` coverage is limited:** Claude Task-tool subagents only; Bash writes are unscoped; the cross-user ownership check is untested.
- **OpenCode behaviour is unproven.**
- **Local reproduction needs a pin:** `lint:agents` reports false drift unless `AGENT_TEAM_CREATOR` points at `.ci/agent-team-creator-src` (the machine's creator is newer than the CI pin).
- **One load-sensitive flaky hook test** (seen twice: a `karpathy-boundary` timing test, and one unnamed run with 2 failures that passed 9 times after).
- **Out of repo:** a live GitHub token in `~/.codex/config.toml`; the liter-llm gateway is down; the `release.yml` action tags are not SHA-pinned (pre-existing).

## Architecture Integrity

- **AGENTS.md / CLAUDE.md "never" rules:** NONE violated.
  - no Go code changed (`git diff origin/main...HEAD -- '*.go'` is empty);
  - no GIN index;
  - generated files were never hand-edited (the drift check enforces it);
  - `progress.json`, the waypoint and the position reminder were never hand-edited.
- **Constraint violations: NONE at the final gate.** During the phase, the knowledge tooling rewrote `.prometheus/knowledge/wiki/index.md` and dropped its frontmatter and about 90 Reference entries. It was restored by hand before commit (`kbd-apply` end-task triggers this).
- **Patient data:** synthetic-only throughout; `scan:prometheus` clean at every commit.

## Cross-Tool Coordination Notes

- **Progress tracking: GAPS FOUND.**
  - `kbd-apply` begin/end transitions were reliable, and N/N moved only on real task ends.
  - Every driver call printed `kbd-memory-log: mirror write failed` and `pk exited 124` (memory writes queued to the outbox).
  - One `end-task` rewrote the wiki index destructively.
  - The final `end-task` of a change announced "Change complete" before an out-of-order task (3.1) was done.
- **Handoff quality: CLEAR between personas.** Each persona's report named files, commands and residual risks, and the tech lead verified claims against the tree before acting. Two reports correctly flagged scope edges: the architect editing files outside its paths, and the global creator drift.
- **Recommendations:**
  - Log failing QA runs.
  - Make the wiki-index writer merge instead of replace.
  - Fix the pk timeout.
  - Default `AGENT_TEAM_CREATOR` to the pinned `.ci` copy in the repo's scripts, so local and CI agree without an env var.

## Lessons Learned

- **Ask the judge for the complete list, and gate re-dispatch on a regression test.** One-finding-per-round judging plus fix-without-test produced 15- and 10-round reviews and repeat defects. Reproducing each claim with a failing test first, as the final gate did, turned 7 CRITICAL claims into 6 real fixes and 1 disproved claim in one round.
- **Generate docs that restate generated facts.** Every roster or ownership table hand-copied into `docs/agent-team.md` drifted. Render those tables from `team.json`, or have `lint:agents` compare them.
- **Pin tool versions for reproducible checks, and make the local default match CI.** A newer global agent-team-creator injected unrelated content into 7 roles once, and made local lint unreliable.
- **Policy sweeps need stem searches and a domain reviewer.** "de-identified" missed "de-identification". The HIPAA persona caught what the grep missed.
- **Harness hook payloads carry identity.** Claude Code sends `agent_id`/`agent_type` in hook input for subagent calls. Design guards around the payload, not session-global state.
- **A guard that polices text will police its own authors.** `phi-lane-guard` blocked a test-writing command containing a FHIR-shaped URL, which is a working fail-closed control but also a sign that command-text matching needs the fetch-token scoping the security review suggested.
- **Windows CI surfaced real bugs** (a dangling-symlink handling defect in the installer), not just portability noise. Keep the 3-OS matrix.

## Next Phase Focus

**Recommended next phase: `phi-lane-readiness`**, the pre-real-PHI gate. Top priorities:

1. **W1–W5:**
   - the lane proof reads the endpoint the harness actually calls (Claude `ANTHROPIC_BASE_URL`, with Bedrock and Vertex off), with a mismatch test;
   - the Tribe profile is isolated with `--setting-sources`, and the note sinks do nothing whenever `PHI_LANE` is set;
   - shell egress is restricted;
   - the Codex and OpenCode templates are complete, with each deny seen to deny in a synthetic dry run and a network capture;
   - FHIR detection covers Azure hosts, `/baseR4`, resource paths, generic `url` fields and array commands.
2. **Compliance records:** BAA status for Tribe and the first partner, a minimum-necessary assessment for the first flow, and a risk analysis entry for the Tribe workstation (164.308(a)(1)(ii)(A)).
3. **Harness proof and tooling debt:**
   - the OpenCode 5-role smoke run;
   - render the docs roster from `team.json`;
   - default to the pinned creator;
   - log failing QA runs;
   - make wiki-index writes non-destructive.

Human decisions needed before it starts:
- which partner EHR and data flow comes first;
- whether Claude alone is the first Tribe lane;
- the transcript-retention stance on Tribe workstations (review decision 6, still open).

## Context for Next Phase

Use this file, `docs/compliance/README.md` (decision record and gate), `evidence/hipaa-review-configure-phi-lanes.md`, and `review/configure-phi-lanes/resolution.md` as prior context for the next `/kbd-assess`.
