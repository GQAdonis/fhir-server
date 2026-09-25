# KBD Constraints — WSO2 FHIR Server

Derived from `CLAUDE.md`, `CONTRIBUTING.md`, `DESIGN.md`, and `.golangci.yml`.
The repo has no `AGENTS.md`. Stack: Go 1.25+ / PostgreSQL 14–18. All commands
run from the repo root.

---

## Blocking Constraints (prevent archiving until resolved)

```yaml
constraints:
  - id: build-passes
    severity: blocking
    description: 'Server binary builds and go vet is clean'
    command: 'make build && make vet'

  - id: unit-tests-pass
    severity: blocking
    description: 'Unit tests pass under the race detector'
    command: 'make test'

  - id: gofmt-clean
    severity: blocking
    description: 'All Go sources are gofmt-clean (CI enforces this)'
    check: 'test -z "$(gofmt -l . )"'

  - id: golangci-lint-clean
    severity: blocking
    description: 'golangci-lint passes with integration and conformance tags'
    command: 'make lint'

  - id: license-header
    severity: blocking
    description: 'Every .go file starts with the WSO2 Apache 2.0 license header'
    check: "grep -L 'Licensed under the Apache License\\|Apache License,' $(git ls-files '*.go')"
    note: 'Any file listed by the check is missing the header.'

  - id: no-hardcoded-secrets
    severity: blocking
    description: 'No hardcoded credentials or DSNs with passwords in Go source or configs'
    check: "grep -rnE 'postgres(ql)?://[^:@/]+:[^@/]+@' --include='*.go' --include='*.yaml' --include='*.yml' . | grep -v _test.go | grep -v example"

  - id: search-fail-closed
    severity: blocking
    description: 'Registry-known but unsupported search parameters return UnsupportedParamError; predicates are never silently dropped'
    note: 'Manual review of internal/store/search.go changes (DESIGN.md §4).'

  - id: no-gin-on-resource-json
    severity: blocking
    description: 'No GIN index on resources.resource_json'
    check: "grep -niE 'gin[^;]*resource_json' internal/db/schema.sql"

  - id: rls-tenant-scope
    severity: blocking
    description: 'New PHI-bearing tables carry tenant_id with FORCE ROW LEVEL SECURITY; store transactions set the tenant scope'
    note: 'Manual review of schema.sql and internal/store changes (DESIGN.md §5).'

  - id: store-handler-race-clean
    severity: blocking
    description: 'Store and handler integration tests pass under the race detector (mirrors CI). Requires Docker.'
    command: 'go test -race -tags integration -timeout 1200s ./internal/store/... ./internal/handler/...'
    applies_when: 'change touches internal/store, internal/handler, internal/index, or internal/db'
```

---

## Warning Constraints (acknowledge before archiving)

```yaml
- id: integration-tests
  severity: warning
  description: 'Full integration suite passes (requires Docker)'
  command: 'make test-integration'

- id: tests-for-new-features
  severity: warning
  description: 'New behaviour has tests next to the code (*_test.go); DB paths use //go:build integration and internal/testutil'

- id: storeapi-mock-in-sync
  severity: warning
  description: 'Store methods added to handler.StoreAPI are also implemented by the handler test mock'

- id: error-wrapping
  severity: warning
  description: 'Errors wrapped with fmt.Errorf("...: %w", err); no ignored errors outside the errcheck allowlist'

- id: schema-migration-noted
  severity: warning
  description: 'Changes to an existing index or table bump schema_version and include an explicit DROP+recreate migration'

- id: helm-lint
  severity: warning
  description: 'Helm chart lints when helm/ changes'
  command: 'make helm-lint'

- id: docs-updated
  severity: warning
  description: 'Behaviour or config changes are reflected in DESIGN.md, config.example.yaml, and website/docs'
```

---

## Workflow Triggers

```yaml
workflow_triggers:
  - event: on_iteration_complete
    action:
      type: command
      target: 'make build && make vet'

  - event: on_change_complete
    action:
      type: command
      target: 'make test'

  - event: on_refinement_complete
    action:
      type: command
      target: "git add -A && git commit -m 'kbd: refine <change-id>'"
```

---

## Path Ownership

- `internal/basedef/*.gz` are generated. Regenerate them with `make refresh-definitions`; don't edit them by hand.
- `internal/seed/fhir-r4-search-params.csv` is embedded base-spec data; change it only deliberately.
- `internal/store/testdata/` holds golden snapshots. Regenerate them with `UPDATE_GOLDEN=1`.
- `openspec/`, `.claude/`, `.agents/`, `.opencode/`, `.kimi-code/` are tool configuration owned by this repo. Don't treat them as disposable.
