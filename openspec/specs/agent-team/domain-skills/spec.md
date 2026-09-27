# agent-team/domain-skills Specification

## Purpose
Defines how the agent team obtains domain skills for healthcare work (HIPAA, FHIR integration, EHR operations, data sync, billing and prior authorization): provenance and license rules, installation per harness, and the minimum project-authored skills.

## Requirements

### Requirement: Every installed skill has recorded provenance
Each third-party skill in the repository SHALL have an entry in `.agents/skills/SOURCES.json` with its source URL, pinned commit, license, and the roles that use it.

#### Scenario: Vendored skill
- **WHEN** a skill from `ajhcs/healthcare-agents` is present under `.agents/skills/`
- **THEN** `SOURCES.json` lists its repository, a 40-character commit, `Apache-2.0`, and its roles

### Requirement: Unlicensed sources are never vendored
Skills whose source repository has no license SHALL be used only through their publisher's plugin or installer, never copied into the repository.

#### Scenario: Anthropic healthcare skills
- **WHEN** the repository is searched for the `anthropics/healthcare` skill directories (`prior-auth`, `procedure-coding`, `icd10-cm`, `fhir-developer`)
- **THEN** none exists under any repository skills directory; the marketplace is registered in `.claude/settings.json` and the plugin is not enabled at project scope (per-user opt-in, synthetic lane only)

### Requirement: Third-party attribution
Vendored Apache-2.0 skills SHALL be attributed in `THIRD_PARTY_NOTICES.md` with the project name, copyright holder, license, and source URL.

#### Scenario: Notice present
- **WHEN** a vendored skill is added
- **THEN** `THIRD_PARTY_NOTICES.md` names its source repository and license

### Requirement: Project-authored skills cover integration operations
The repository SHALL provide `ehr-integration-onboarding`, `fhir-data-sync-runbook`, `payer-documentation-rules` and `phi-lane-policy` skills. `payer-documentation-rules` MUST instruct agents to cite coverage sources (LCD/NCD through the CMS Coverage connector, or payer policy URLs) rather than rely on memorized payer rules.

#### Scenario: Payer rule question
- **WHEN** the billing role answers what documentation a payer requires for a procedure
- **THEN** the skill requires a cited source for each requirement

### Requirement: Skills are available in every harness
Every team domain skill (listed under `project` or `thirdParty` in `.agents/skills/SOURCES.json`) SHALL be present, byte-identical, in each harness skill location: `.agents/skills/` (the source), `.claude/skills/`, `.opencode/skills/`, `.kimi-code/skills/` and `.minimax/skills/`. Generator-owned skills (listed under `generated`, such as those installed by `openspec init`) are excluded, because their generator writes a harness-specific variant into each location.

#### Scenario: Mirror check
- **WHEN** a skill is listed under `project` or `thirdParty` in `SOURCES.json`
- **THEN** the same skill directory exists, byte-identical, in the four harness mirrors, and `node scripts/agent-team/mirror-skills.mjs --check` fails on any difference

#### Scenario: Generated skills are not mirrored
- **WHEN** a skill is listed under `generated` in `SOURCES.json`
- **THEN** the mirror script neither copies nor compares it, and each harness keeps the generator's own variant

#### Scenario: Every source skill is classified
- **WHEN** a directory with a `SKILL.md` exists under `.agents/skills/`
- **THEN** it is listed in exactly one of `project`, `thirdParty` or `generated`, or the mirror check fails naming it
