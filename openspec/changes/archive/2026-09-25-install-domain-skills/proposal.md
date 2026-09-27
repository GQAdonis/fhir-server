## Why

The five new domain roles (HIPAA, FHIR integration, EHR integration management, data sync, billing and prior authorization) need domain skills that the machine does not have. Skills from the web must come with known provenance and license. Where no credible skill exists, the project must author its own.

## What Changes

- Register Anthropic's `anthropics/healthcare` marketplace for Claude Code at project scope. The `healthcare@healthcare` plugin stays per-user opt-in and is not enabled at project scope (ATH-D-007). It is not vendored, because the repo has no license file (ATH-D-006).
- Vendor selected Apache-2.0 skills from `ajhcs/healthcare-agents` and `PhenoML/ClaudeFHIRSkill` into `.agents/skills/`, pinned to a commit, with attribution in `THIRD_PARTY_NOTICES.md`.
- Author four project skills: `ehr-integration-onboarding`, `fhir-data-sync-runbook`, `payer-documentation-rules` and `phi-lane-policy`.
- Mirror installed skills to every harness skill directory.
- Record provenance in `.agents/skills/SOURCES.json`, and the Firecrawl research in `evidence/skill-research.md`.

## Capabilities

### New Capabilities
- `agent-team/domain-skills`: which domain skills the team may use, where they come from, their licenses, and how they are installed per harness.

### Modified Capabilities

## Impact

New files under `.agents/skills/`, `.claude/skills/`, `.opencode/skills/`, `.kimi-code/skills/` and `.minimax/skills/`, plus `THIRD_PARTY_NOTICES.md` and an `extraKnownMarketplaces` entry in `.claude/settings.json`. No Go code changes.
