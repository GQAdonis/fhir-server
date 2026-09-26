## Purpose

Defines the portable agent-team manifest that is the single source of truth for every harness's agent definitions, and the structural rules it must satisfy.

## ADDED Requirements

### Requirement: The manifest is valid and complete
`.agent-team/team.json` SHALL pass `agent-team-creator validate`, and SHALL define exactly the roles listed, in order, in the "Portable team roster" section of `docs/agent-team.md`; `build-manifest --check` fails otherwise.

#### Scenario: Validation
- **WHEN** `node <agent-team-creator>/scripts/cli.mjs validate --input` runs on the team request
- **THEN** it reports no errors

#### Scenario: Roster documented
- **WHEN** a role is added to or removed from the manifest without updating the "Portable team roster" section of `docs/agent-team.md`
- **THEN** `node scripts/agent-team/build-manifest.mjs --check` exits non-zero naming both rosters

### Requirement: Write ownership is disjoint
No two roles SHALL declare overlapping write paths in `owns`. Review roles SHALL own only a findings path.

#### Scenario: Overlap
- **WHEN** two roles list the same path or overlapping globs
- **THEN** the ownership check fails and names both roles

### Requirement: Every role carries a PHI-lane block and a Harness card
Each role prompt SHALL contain the following:
- a PHI-lane section stating whether the role may process real PHI (only through a Tribe-endpoint lane, ATH-D-001), and that the synthetic default applies otherwise;
- a Harness card listing its preloaded and invoke-when-needed skills, its tools, and its model for each of Claude Code, Codex, OpenCode, Kimi Code and MiniMax Code.

#### Scenario: Card check
- **WHEN** the manifest is checked
- **THEN** every role has both sections, and the Harness card names all five harnesses

### Requirement: Skills bind to installed ids
Every skill id in a role's `skills` SHALL resolve to an installed repository skill.

#### Scenario: Unknown skill
- **WHEN** a role lists a skill that is not installed
- **THEN** the check fails naming the role and skill
