# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

WSO2 FHIR Server: a FHIR R4 REST server written in Go (1.25+) and backed by PostgreSQL (14–18). Module path `github.com/wso2/fhir-server`. One binary (`cmd/server`) and one database. `DESIGN.md` explains the reasoning behind each subsystem; read the relevant section before making structural changes.

## Commands

```bash
make build              # go build with -X version stamp from version.txt → ./fhir-server
make run                # go run ./cmd/server (config via env vars or --config/-c path, or FHIR_SERVER_CONFIG)
make fmt vet lint       # gofmt -w . / go vet / golangci-lint (lint runs with integration,conformance tags)
make test               # unit tests: go test -race -count=1 ./...   (no DB, no Docker)
make test-integration   # go test -tags integration -timeout 300s ./...   (Docker required)
make test-conformance   # go test -tags conformance ./internal/conformance/...
make helm-lint          # needs --set database.existingSecret.name=placeholder (the target sets it)
make refresh-definitions  # regenerate embedded internal/basedef/*.gz via scripts/refresh-definitions.py
```

Running a subset:

```bash
go test ./internal/fhirpath/ -run TestEvaluate_Where_Match -v
go test -tags integration -timeout 300s ./internal/store -run TestName -v
FHIR_TEST_POSTGRES_IMAGE=postgres:14-alpine go test -tags integration ./internal/store/...
UPDATE_GOLDEN=1 go test -tags integration ./internal/store -run TestBundleWritePath_GoldenSnapshot   # regenerate golden
```

- Integration tests (`//go:build integration`) start a fresh `postgres:18-alpine` testcontainer for each test through `internal/testutil`: `MustDB(t)`, `MustSeededDB(t)` (adds the base search params), and `MustRegistry(t, pool)`.
- CI also runs `go test -race -tags integration` on `./internal/store/... ./internal/handler/...`, so new store and handler code must be race-clean under the integration tag.
- Handler unit tests use a mock that implements `handler.StoreAPI` (`internal/handler/store.go`). If you add a store method that handlers call, add it to that interface and to the mock.
- The `cd miscellaneous/fhir-server-go` line in `TESTING.md` is stale. Run everything from the repo root.
- Docs site: `website/` is Docusaurus (`npm ci && npm run build` / `npm start`).

## Conventions (enforced)

- Every `.go` file starts with the Apache 2.0 WSO2 license header. Copy it from an existing file.
- Code must be gofmt-clean and pass golangci-lint (`.golangci.yml`). Wrap errors with `fmt.Errorf("...: %w", err)`. The only errors that may be ignored are the best-effort calls in the errcheck allowlist.

## Architecture

Request flow: `internal/handler` (chi router, content negotiation for JSON/XML/Turtle, OperationOutcome errors, bundles, `$operations`) → `internal/store` (transactions, versioning, search SQL) → PostgreSQL.

**Storage model** (`internal/db/schema.sql`):
- Every resource type lives in one `resources` table as JSONB, keyed by `(tenant_id, resource_type, fhir_id)`.
- Each write appends a full snapshot to `resource_history` with an integer `version_id`.
- DELETE is a soft delete (`is_deleted`).
- Adding a resource type or an IG never needs a schema change.
- There is intentionally **no GIN index on `resource_json`**; don't add one.
- The schema is idempotent (`IF NOT EXISTS`) and versioned in `schema_version`. Changing an *existing* index needs an explicit DROP+recreate migration, because `CREATE INDEX IF NOT EXISTS` won't alter it.

**Search** is the most complex subsystem:
- At write time, `internal/index` evaluates each search parameter's FHIRPath expression (`internal/fhirpath`, a deliberately small subset) and writes the values into typed tables: `sp_string`, `sp_token`, `sp_date`, `sp_number`, `sp_quantity`, `sp_uri`, `sp_reference`, `sp_coords`. This runs in the same transaction as the resource write; on update the resource's rows are deleted and re-inserted.
- Search queries only read the `sp_*` tables. The JSON documents are fetched afterwards, only to build the result.
- Date and number values are stored as `[low, high]` ranges at write time. Quantities are UCUM-canonicalized.
- The query builder (`internal/store/search.go`) types each parameter by looking it up in the in-memory registry (`internal/searchparam`).
- Chaining and `_include`/`_revinclude` are separate queries over `sp_reference`, not JOINs.

**Fail-closed rule:** a *known* parameter the engine can't evaluate correctly (unsupported type, a chain that's too deep, an unanswerable `:missing`) must return `UnsupportedParamError` → OperationOutcome. It must never drop the predicate and return a wider result set. A parameter that isn't in the registry at all falls back to heuristic typing (`buildHeuristicExists`) instead of being rejected.

**Search-parameter registry:**
- The base R4 params are embedded as a CSV (`internal/seed`) and seeded with `ON CONFLICT DO NOTHING` on every boot. They are stored in `search_param_definitions`, whose `ig_source` column is `''` for base params, `'user'` for API-created ones, and `name@version` for params from an IG.
- The registry is process-local.
- `SEARCH_PARAM_WATCH=true` runs a Postgres LISTEN/NOTIFY watcher (`watcher.go`) so all replicas stay eventually consistent.
- When a `SearchParameter` resource is written, the DB commit happens *before* the in-memory update.
- Existing data is **not** reindexed when a parameter changes (known limitation, issue #11).

**Multi-tenancy:**
- Tenants are addressed with the `/t/{tenant}` route prefix, or everything runs as the `default` tenant.
- PHI tables have `tenant_id` columns that default to `app.current_tenant` and are protected by `FORCE ROW LEVEL SECURITY`. The store sets the tenant scope on every transaction (`SET LOCAL` for writes, `SET` for reads).
- The server must connect as a non-superuser role without `BYPASSRLS`.
- Search params, IGs, and closure tables are shared across tenants.

**Validation:**
- Base structural checks (`internal/basedef` embedded definitions + `internal/validate`) are on by default.
- Profile validation is opt-in and only applies to resources that declare `meta.profile`. Unknown profile URLs are skipped, not rejected.
- Referential integrity (`internal/store/integrity.go`) is on by default: a dangling reference on write returns 422, and deleting a resource that is still referenced returns 409. Each check can be disabled.
- Terminology (`code:in`, `:below`) is delegated to an external server (`internal/terminology`). There is no local code-system logic.

**Startup** (`cmd/server/main.go`):
1. Config: env var > YAML > default. YAML parsing is strict, so unknown keys are errors. See `config.example.yaml`.
2. DB connect.
3. Optional table creation.
4. Seed search params.
5. Load base definitions.
6. Load the registry and start the watcher.
7. Build the store and router.
8. **Start listening**, then load IG packages (`internal/ig`) in background goroutines. `/health/live` passes immediately; `/health/ready` waits for IGs to load and a DB ping to succeed.

IG load failures are non-fatal but keep readiness at 503.

Concurrency: optimistic concurrency via `If-Match`/ETag (412 on conflict). PATCH takes a row lock inside its transaction.

## UI design (Impeccable)

UI work uses the `impeccable` skill.
- `PRODUCT.md` (repo root) is the shared product record for every UI surface: users, purpose, PHI constraints, brand status.
- Root `DESIGN.md` is the server architecture doc, **not** a visual system. Each UI surface is listed in `pnpm-workspace.yaml` (there only for Impeccable's workspace resolution; npm ignores it) and has its own `DESIGN.md`, currently just `website/DESIGN.md`. The Tribe Health brand is defined in the tribehealth.ai site repo, `../simple-ai-care/DESIGN.md`; `PRODUCT.md` points there.
- Run Impeccable from the surface directory (`cd website`) or with `--target website/...`, never against the repo root. A new surface needs a `pnpm-workspace.yaml` entry and its own `DESIGN.md` before any design work, otherwise it inherits the architecture doc.

## Spec workflow

OpenSpec is initialized (`openspec/`, schema `spec-driven`). Propose changes with `/opsx:propose "<idea>"`. KBD phase state lives in `.kbd-orchestrator/`. Pick work from `current-waypoint.json` `nextChange`, and drive changes task by task with `/kbd-apply`. Never hand-edit `progress.json`, `current-waypoint.*` or `position-reminder.txt`; a hook refuses those edits.

## Agent team

Fourteen roles cover architecture (including ideation), development, testing, review, validation, infrastructure, orchestration (including knowledge curation), HIPAA privacy, FHIR integration, EHR integration management, data sync, and billing/prior authorization. They are defined once in `.agent-team/team.json`, which is built from `.agent-team/roles/` by `node scripts/agent-team/build-manifest.mjs`. They are generated for Claude Code (`.claude/agents/`), Codex (`.codex/`), OpenCode, Kimi Code and MiniMax Code by `node scripts/agent-team/install-exports.mjs`. Never hand-edit the generated files; `lint:agents` fails on drift. Roster, models, the persona → skill matrix, hand-offs and prerequisites are in `docs/agent-team.md`.

- Lead a session with `claude --agent fhir-tech-lead`, or ask for a persona by name. Project agents load at session start.
- Frontmatter preloads only repo-resident skills (`.claude/skills/`). Machine-local skills are listed in the doc's prerequisites block, and agents name any that are missing and continue.
- Archive gate:
  - `fhir-code-reviewer` for every change;
  - `fhir-security-compliance-reviewer` for sensitive paths;
  - `fhir-conformance-validator` last.
- Any CRITICAL finding blocks. For Go changes, an unverified `make lint` blocks too.

Hooks (`.claude/hooks/`, TypeScript 7 compiled to committed `dist/*.mjs` and run as `node <script>`, so they work on macOS, Linux and Windows):

```bash
npm --prefix .claude/hooks ci && npm --prefix .claude/hooks run build   # after editing src/*.mts
npm --prefix .claude/hooks test
npm --prefix .claude/hooks run check:dist       # committed dist/ matches src/
npm --prefix .claude/hooks run lint:agents      # agent files vs docs/agent-team.md
npm --prefix .claude/hooks run scan:prometheus  # PHI/secret scan of committable .prometheus/
```

`.prometheus/` is committed Karpathy continuous-improvement history:
- the metadata-only agent ledger;
- session notes;
- KBD boundary records.

Conversation text and local caches are gitignored there. Never write prompt text, tool output or realistic patient data into it.
