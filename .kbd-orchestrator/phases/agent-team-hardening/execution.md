# Execution — agent-team-hardening

## Backend

`openspec` (spec-driven). Tasks are driven one at a time with `/kbd-apply` (`~/.claude/skills/kbd-apply/kbd-apply.sh begin-task|end-task|verify|archive`).

## Dispatch contract

| Order | Change | Lead persona | Gates |
|---|---|---|---|
| 1 | install-domain-skills | fhir-architect (research), fhir-infra-release-engineer (install) | QA, adversarial diff, code-reviewer, security (vendored code), validator |
| 2 | define-portable-team-manifest | fhir-architect | QA, adversarial diff, code-reviewer, validator |
| 3 | export-team-to-harnesses | fhir-infra-release-engineer | QA, adversarial diff, code-reviewer, validator |
| 4a | wire-hooks-per-harness | fhir-infra-release-engineer | QA, adversarial diff, code-reviewer, security, validator |
| 4b | retire-merged-agents | fhir-tech-lead | QA, adversarial diff, code-reviewer, validator |
| 5 | configure-phi-lanes | fhir-infra-release-engineer + hipaa-privacy-officer | QA, adversarial diff, code-reviewer, security, validator |
| 6 | document-and-verify-cross-harness-team | fhir-architect + fhir-conformance-validator | QA, adversarial diff, code-reviewer, validator |

## Rules in force

- Synthetic data only; no real PHI anywhere in this phase (ATH-D-001).
- Tribe endpoint, model names and keys are env-var configuration only.
- `anthropics/healthcare` is plugin-only; never vendored (ATH-D-006).
- Adversarial diff packets include the cumulative `git diff main...HEAD` scoped to the change.
- Commit and push only on operator request.

## Deviations and decisions

- **ATH-D-007** (recorded 2026-09-25, operator may override): the `healthcare@healthcare` plugin is registered but not enabled at project scope. It is per-user opt-in and synthetic lane only. The reason: it auto-starts local and hosted MCP servers and cannot be pinned to the reviewed commit.
- `install-domain-skills` scope additions from review:
  - vendor notes;
  - stale-mirror detection;
  - a CI mirror check in `agent-tooling.yml` (pulled forward from `document-and-verify-cross-harness-team`).
- `define-portable-team-manifest` security review: two items were carried into `configure-phi-lanes` as tasks 4.1 (Tribe profiles *deny* off-lane channels) and 4.2 (a ledger rotation script plus a ledger-key allowlist). Both are registered with KBD.
- Pending operator question: should cloud harnesses keep "synthetic **or de-identified**" data, or be narrowed to synthetic-only? The current text allows de-identified data, as the security reviewer noted. The HIPAA officer role now *recommends*, and the designated privacy official (operator) decides (45 CFR 164.530(a)).
- `export-team-to-harnesses`:
  - Codex needs `[agents.<id>]` registration, so the installer generates `.codex/config.toml`, and the project must be trusted in Codex (operator action).
  - `AGENTS.md` generator lives in `scripts/agent-team/gen-agents-md.mjs`, not `.claude/hooks/src/` (no compile step; same place as the other team scripts).
  - The drift check runs the team scripts from `lint:agents`, and CI checks out agent-team-creator before the lint step.
- **Operator question (ATH-D-003):** `MINIMAX_DATA_DIR=.minimax` relocates all MiniMax user data, including auth and provider config. Using the project directory means a separate `mcode login` whose credentials land in `.minimax/auth` inside the repo tree. That path is gitignored but still present. The alternative is to install the team agents to the default `~/.minimax/agents`, which needs no project login but is user-scoped.
- **Operator question (security review of export):** `fhir-tech-lead` gained Edit/Write when curation merged in, and its write scope is enforced only by its prompt. Accept this, or add a PreToolUse path allowlist for the tech lead (it fits `wire-hooks-per-harness`)?
- `wire-hooks-per-harness` follow-up (pre-existing, out of scope): `paths.mts` `rel()` compares case-sensitively and doesn't resolve symlinks, so a case-variant or symlinked absolute path to a protected file is allowed. Fix alongside `phi-lane-guard` in `configure-phi-lanes`.
- Judge gateway (liter-llm, localhost:4000) returned HTTP 401 and then stopped responding. The operator must repair it (`/liter-llm-bridge configure`) before the `wire-hooks-per-harness` judge round and all later judge rounds.
