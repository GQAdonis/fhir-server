## Purpose

Defines how the agent team is documented for contributors and how its agent definitions, hooks and committed logs are verified automatically on macOS, Linux and Windows.

## ADDED Requirements

### Requirement: The agent team is documented
The repository SHALL contain `docs/agent-team.md`, listing every `fhir-*` agent with its model and rationale, its owned KBD stages, its skills, and its hand-offs. It SHALL include a prerequisites table naming each skill not vendored in the repository with its source pack, and a description of what the Karpathy hooks record and never record.

#### Scenario: New contributor onboarding
- **WHEN** a contributor reads `docs/agent-team.md`
- **THEN** they can list the skills and tools they must install for every agent to be fully capable

### Requirement: Agent definitions are linted
A lint command SHALL fail when any `.claude/agents/fhir-*.md` has invalid frontmatter, a model other than `opus`, `sonnet`, `haiku`, `fable` or `inherit`, a skill that neither resolves locally nor appears in the prerequisites table, or a missing required prompt section.

#### Scenario: Unknown skill added
- **WHEN** an agent lists a skill that is neither installed nor documented as a prerequisite
- **THEN** the lint exits non-zero naming the agent and the skill

### Requirement: Agent tooling is verified on three operating systems
Continuous integration SHALL, on Ubuntu, macOS and Windows runners, install the hook package, compile it (the dist-freshness check compiles `src/` into a temporary directory and requires byte equality with the committed `dist/`; CI does not overwrite `dist/`, so drift cannot be masked), run its tests against the committed `dist/`, lint agents, scan `.prometheus/`, and execute at least one compiled hook in exec form with a fixture payload.

#### Scenario: Windows exec-form run
- **WHEN** the workflow runs on `windows-latest`
- **THEN** piping a SubagentStop fixture into `node .claude/hooks/dist/agent-ledger.mjs` exits 0 and appends one ledger line

### Requirement: Model policy matches the roster
The `local` lane of `.kbd-orchestrator/project.json` `model_policy.registry` (the Claude Code agent team) SHALL map `small`, `medium` and `frontier` to the current model family (Haiku 4.5, Sonnet 5, Opus 5.5), consistent with the models declared in the agent files. Every lane's `frontier` entry SHALL be Opus 5.5. Self-hosted GPU lanes (`t4`, `l4`) MAY keep open-weight models for `small` and `medium`; they are not the agent team.

#### Scenario: Policy inspected
- **WHEN** `project.json` is read
- **THEN** the `local` lane lists `claude-haiku-4-5-20251001`, `claude-sonnet-5` and `claude-opus-5-5`, every `frontier` entry is `claude-opus-5-5`, and no entry names an older Claude model
