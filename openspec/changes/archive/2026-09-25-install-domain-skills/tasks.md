## 1. Research record

- [x] 1.1 Write `.kbd-orchestrator/phases/agent-team-hardening/evidence/skill-research.md`: Firecrawl queries, result URLs, provenance (stars, license, last push), and a select/reject decision per new role (HIPAA; FHIR integration; EHR integration manager; data sync; billing/prior-auth), including targeted searches (Security Rule risk analysis, SMART backend services, Bulk `$export`, reconciliation, CARC/RARC appeals, X12 278); verify every new role has ≥1 query and ≥1 decision

## 2. Plugin (not vendored)

- [x] 2.1 Add `anthropics/healthcare` to `extraKnownMarketplaces` in `.claude/settings.json` (project scope; `healthcare@healthcare` is per-user opt-in, not enabled at project scope — ATH-D-007); verify `settings.json` parses and the Anthropic skill names do not appear under any repo skills directory

## 3. Vendored skills

- [x] 3.1 Vendor the selected `ajhcs/healthcare-agents` skills (pinned commit, Apache-2.0) into `.agents/skills/`, and the `PhenoML/ClaudeFHIRSkill` FHIR skill (pinned commit, Apache-2.0); verify each has a `SKILL.md` with valid frontmatter and that the upstream LICENSE text is retained alongside it
- [x] 3.2 Write `THIRD_PARTY_NOTICES.md` and `.agents/skills/SOURCES.json` (url, commit, license, roles for every third-party skill); verify via script that every non-project skill in `.agents/skills/` has a SOURCES entry with a 40-char commit

## 4. Project skills

- [x] 4.1 Author `ehr-integration-onboarding`, `fhir-data-sync-runbook`, `payer-documentation-rules` (cite-sources rule) and `phi-lane-policy` (synthetic default; Tribe-lane only for PHI, ATH-D-001) in `.agents/skills/`; verify frontmatter parses and `scan:prometheus`-style PHI/secret scan of the new files is clean

## 5. Mirror and prerequisites

- [x] 5.1 Mirror all repository skills to `.claude/skills/`, `.opencode/skills/`, `.kimi-code/skills/`, `.minimax/skills/` (script, idempotent) and update the prerequisites block in `docs/agent-team.md` for new machine-local dependencies; verify the mirror check passes and `npm --prefix .claude/hooks run lint:agents` passes
