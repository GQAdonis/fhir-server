## Why

Two lifecycle responsibilities remain without an owner. One is infrastructure rollout: GitHub Actions, Helm, Docker and the release workflow. The other is the Karpathy continuous-improvement loop: curating the agent ledger into durable knowledge and feeding reflection.

## What Changes

- Add `fhir-infra-release-engineer` (sonnet). It owns `.github/workflows/`, `helm/`, `Dockerfile` and `docker-compose.yml`; its standing rules are SHA-pinned actions, CI parity with the `make` targets, and helm-lint secret placeholders.
- Add `fhir-knowledge-curator` (haiku). It reads `.prometheus/agent-ledger.jsonl` and `raw/` notes, runs `pk lint`/`pk ingest`, drafts the Karpathy section of `reflection.md`, rotates the ledger monthly, and runs `scan:prometheus` before any commit of `.prometheus/`.

## Capabilities

### New Capabilities
- `agent-team/operations-personas`: the infrastructure and knowledge-curation agents and the rules they apply.

### Modified Capabilities

## Impact

- New files in `.claude/agents/`.
- Depends on the ledger layout from `agent-tooling/karpathy-logging`.
