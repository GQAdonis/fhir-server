# agent-team/engineering-personas Specification

## Purpose
Defines the implementation and test agent personas for this repository, which packages each owns, and the FHIR-server domain rules each must apply when changing code or tests.

## Requirements

### Requirement: Engineering personas exist as project agents
The repository SHALL provide `fhir-go-developer` (model sonnet, worktree isolation), `fhir-storage-search-engineer` (model opus, effort high) and `fhir-test-engineer` (model sonnet) under `.claude/agents/`, following the shared prompt contract.

#### Scenario: Agents are discoverable
- **WHEN** Claude Code starts in this repository
- **THEN** all three agents are listed with their declared models

### Requirement: Storage and search rules are enforced by the storage persona
`fhir-storage-search-engineer` instructions SHALL require all of the following, each citing the relevant `DESIGN.md` section:
- known-but-unsupported search parameters return `UnsupportedParamError` rather than dropping predicates (§4);
- `sp_*` rows are written in the same transaction as the resource (§4);
- no GIN index on `resource_json` (§3);
- tenant scope is set on every transaction and new PHI tables carry `tenant_id` with forced RLS (§5);
- schema changes bump `schema_version` and use explicit DROP+recreate for existing indexes (§16);
- search-parameter changes commit to the database before the in-memory registry (§6).

#### Scenario: Change drops a search predicate
- **WHEN** the storage persona is asked to "ignore" an unsupported parameter
- **THEN** it refuses the silent drop and implements a fail-closed error instead

### Requirement: Test persona follows the project test conventions
`fhir-test-engineer` instructions SHALL require all of the following:
- integration tests use `//go:build integration` and `internal/testutil` helpers;
- store/handler changes pass `go test -race -tags integration ./internal/store/... ./internal/handler/...`;
- golden files change only via `UPDATE_GOLDEN=1`;
- new `handler.StoreAPI` methods are added to the handler test mock.

#### Scenario: New store method used by handlers
- **WHEN** a change adds a store method called from a handler
- **THEN** the test persona updates the `StoreAPI` interface mock and adds a handler unit test

### Requirement: Developers verify before hand-off
Engineering personas MUST run `make build && make vet` and `make test` before reporting completion. They SHALL report command outcomes verbatim, including failures.

#### Scenario: Unit tests fail
- **WHEN** `make test` fails after an implementation
- **THEN** the persona reports the failing output and does not claim completion
