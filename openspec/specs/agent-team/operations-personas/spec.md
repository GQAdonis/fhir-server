# agent-team/operations-personas Specification

## Purpose
Defines the agent personas that own infrastructure rollout and the Karpathy knowledge-curation loop, and the operating rules each applies.

## Requirements

### Requirement: Infrastructure persona owns CI/CD and deployment assets
`fhir-infra-release-engineer` (model sonnet) SHALL be the persona for changes to `.github/workflows/`, `helm/`, `Dockerfile`, `docker-compose.yml`, the `Makefile` targets that CI invokes, and `.gitignore` entries for build output. It MUST NOT edit `version.txt`, which only the release workflow writes. Its instructions SHALL require:
- third-party actions pinned by full commit SHA with a version comment;
- CI steps mirroring the local `make` targets;
- `helm lint` invoked with a database secret placeholder.

#### Scenario: Tag-pinned action found
- **WHEN** the persona edits a workflow containing `actions/checkout@v4`
- **THEN** it replaces the tag with the commit SHA and a `# v4` comment

### Requirement: Knowledge curator maintains the Karpathy loop
There SHALL be no separate knowledge-curator agent. `fhir-tech-lead` SHALL carry the Karpathy loop duties, using the curation skill:
- summarize ledger activity into knowledge-base notes;
- run the project knowledge lint;
- draft the Karpathy lessons section of the phase `reflection.md`;
- rotate `agent-ledger.jsonl` into `.prometheus/ledger/<yyyy-mm>.jsonl` at month boundaries (resetting `.prometheus/.flush-cursor`).

It MUST run the `.prometheus/` PHI/secret scan before proposing any commit of that directory.

#### Scenario: Scan finds a match
- **WHEN** the scan reports a match in `.prometheus/`
- **THEN** the tech lead stops, reports file and line, and does not stage the directory
