## Why

Implementation must not grade itself. Independent read-only review and validation personas provide the gate before `/opsx:archive`. They cover Go and project-rule review, patient-data and security compliance (including the committed `.prometheus/` logs), and spec and goal conformance.

## What Changes

- Add `fhir-code-reviewer` (sonnet, read-only) to review diffs against `CLAUDE.md` conventions and `.kbd-orchestrator/constraints.md`.
- Add `fhir-security-compliance-reviewer` (opus, read-only) for PHI/HIPAA review, RLS bypass, SQL injection, tenant leakage, and review of committed `.prometheus/` content.
- Add `fhir-conformance-validator` (sonnet, read-only) to run `opsx:verify`, `kbd-goal-check` and the verification commands, and gate archive.

## Capabilities

### New Capabilities
- `agent-team/quality-personas`: the review and validation agents, their read-only posture, their findings format and their gate role.

### Modified Capabilities

## Impact

- New files in `.claude/agents/`.
- The per-change QA flow in execution gains named reviewers.
