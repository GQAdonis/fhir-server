# Phase goal check — agent-team-hardening (2026-09-26)

Run by `fhir-conformance-validator` (read-only); recorded by `fhir-tech-lead`.

**goal-check: GAPS** (G6 partial; everything else MET)

| Goal | Verdict | Evidence |
|---|---|---|
| G1 agent-team-creator research, 14-role conversion | MET | `assessment.md` (creator has no healthcare area: expert-supplied manifest, documented); `.agent-team/roles/` 14 files; merged/retired roles archived |
| G2 HIPAA expert role | MET | `hipaa-privacy-officer`, exported 5x; `evidence/hipaa-review-configure-phi-lanes.md` (PASS) |
| G3 FHIR integration specialist | MET | `fhir-integration-specialist`, exported 5x, smoke-tested |
| G4 EHR integration + sync roles | MET | `ehr-integration-manager`, `data-sync-coordinator`, exported 5x |
| G5 billing / prior-auth | MET | `billing-prior-auth-specialist`, exported 5x |
| G6 same team in every harness | PARTIAL | `lint:agents` 14 roles x 5 harnesses; smoke (`evidence/cross-harness-smoke.md`): Claude 5/5, Codex 5/5, Kimi 5/5, MiniMax 5/5 file presence, **OpenCode 0/5** (CLI accepts only primary agents via `--agent`; machine-local default-model config broken) |
| G7 skills researched, installed, cards list skills/tools/model | MET | `evidence/skill-research.md`, `.agents/skills/SOURCES.json`, generated harness cards (test-enforced) |

Round-2 plan fixes (applied without re-review): all three CONFIRMED — change ordering, `phi-lane-guard` in every harness adapter with tests, `AGENTS.md` generated and drift-checked.

Commands (pinned `AGENT_TEAM_CREATOR`): check:dist OK; hook tests 164/164; lint:agents OK; scan:prometheus clean; team script tests 34/34; mirrors in sync; AGENTS.md current; `openspec validate --strict` valid for the three open changes; no Go files changed.

Gaps carried to the final gate: written `fhir-code-reviewer` verdicts for `configure-phi-lanes` and `document-and-verify-cross-harness-team`, and a written `fhir-security-compliance-reviewer` verdict for `configure-phi-lanes`. G6 closes when OpenCode runs the 5-role smoke set (a primary-agent invocation path or a fixed local OpenCode config).
