## Why

Implementation and testing are where this server's correctness rules are most easily broken: fail-closed search, RLS tenancy, write-time indexing, schema migration discipline, and race-clean integration tests. Dedicated engineering personas carry those rules in their instructions and own the matching packages.

## What Changes

- Add `fhir-go-developer` (sonnet, worktree isolation) for general Go implementation in handler, validate, fhirpath, config, ig, patch and related packages.
- Add `fhir-storage-search-engineer` (opus, high effort) for `internal/store`, `internal/index`, `internal/db`, `internal/searchparam` and schema changes.
- Add `fhir-test-engineer` (sonnet) for unit, testcontainers integration, race, conformance and golden-snapshot tests.
- All three follow the prompt contract defined by `agent-team/architecture-personas`.

## Capabilities

### New Capabilities
- `agent-team/engineering-personas`: the implementation and test agents, the packages they own, and the domain rules they enforce.

### Modified Capabilities

## Impact

- New files in `.claude/agents/`.
- No production code changes.
