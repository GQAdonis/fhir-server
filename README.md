<div align="left">
  <h1>WSO2 FHIR Server</h1>
  <p><strong>WSO2 FHIR Server is a blazing-fast, open-source FHIR server written in Go and backed by PostgreSQL.</strong> Lightweight to run and scale — a single binary, one database, and no per-resource schema migrations.</p>

<!-- License & Project Info -->
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![FHIR](https://img.shields.io/badge/HL7-FHIR-e0561f)](https://hl7.org/fhir/)
[![Go Version](https://img.shields.io/github/go-mod/go-version/wso2/fhir-server)](./go.mod)

<!-- Build & Activity -->
[![CI](https://github.com/wso2/fhir-server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wso2/fhir-server/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/wso2/fhir-server)](https://github.com/wso2/fhir-server/releases/latest)
[![GitHub last commit](https://img.shields.io/github/last-commit/wso2/fhir-server.svg)](https://github.com/wso2/fhir-server/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/wso2/fhir-server.svg)](https://github.com/wso2/fhir-server/issues)
</div>

## Why WSO2 FHIR Server?

Standing up a FHIR server usually means operating a heavyweight platform with many moving parts to deploy, tune, and keep alive. Teams that just need a conformant FHIR API end up spending their time running the server instead of building on top of it.

Healthcare integrations also evolve constantly — a new resource type here, a new Implementation Guide there. Adopting them should be a configuration change, not a project.

## What is WSO2 FHIR Server?

WSO2 FHIR Server is an open-source FHIR REST server written in Go and backed by PostgreSQL. It ships as a single self-contained binary, needs exactly one database, and accepts **every concrete FHIR resource type out of the box** — storage is schema-generic, so no type needs enabling and using a new one takes no migration.

Key capabilities:

- **Full FHIR REST API** — CRUD with versioning and history, conditional interactions, batch/transaction bundles, `$everything`, `$validate`, and a generated CapabilityStatement.
- **Rich search** — string, token, date, reference, number, quantity, URI and composite parameters, with modifiers, chaining, `_include`/`_revinclude`, and custom `SearchParameter` registration.
- **Validation** — request-level and base-spec validation on by default, plus opt-in profile validation against loaded Implementation Guides.
- **Implementation Guides** — configure IG packages to load at startup; their profiles and search parameters feed validation and the CapabilityStatement.
- **Terminology** — code validation backed by configurable terminology support.
- **Multi-tenancy** — physical (per-tenant server and database) or logical (shared) isolation models.
- **Operations-ready** — liveness/readiness probes, structured JSON logs, observability hooks, and configuration via YAML, environment variables, or both.

## How does it work?

The server is a single Go process in front of PostgreSQL — there are no other moving parts.

Resources are stored as JSON in a schema-generic table, alongside a full version history. At write time, a built-in FHIRPath evaluator extracts search-parameter values into a small set of typed index tables (strings, tokens, dates, references, …). Searches then compile directly to indexed SQL, which is what keeps queries fast without per-resource schemas:

```
                       ┌──────────────────────────────┐
 HTTP (FHIR JSON)      │         fhir-server          │        PostgreSQL
──────────────────────▶│  router → validate → store   │──▶  resources + history
                       │  FHIRPath → search indexes   │──▶  sp_* index tables
                       └──────────────────────────────┘
```

Because storage is schema-generic, a new resource type — or a whole Implementation Guide — is a configuration change, not a migration.

Read more in the **[Architecture documentation](https://wso2.github.io/fhir-server/docs/architecture/)**.

## Getting Started

The fastest way to try the server is Docker Compose, using the released container image from [GHCR](https://github.com/wso2/fhir-server/pkgs/container/fhir-server):

```bash
curl -LO https://raw.githubusercontent.com/wso2/fhir-server/main/docker-compose.yml
docker compose up -d
```

Then create your first resource:

```bash
curl -s -X POST http://localhost:9090/fhir/r4/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{"resourceType":"Patient","name":[{"family":"Smith","given":["Alice"]}]}'
```

Follow the **[Quickstart Guide](https://wso2.github.io/fhir-server/docs/get-started/quickstart/)** for the full walkthrough, or the **[Deployment Guide](https://wso2.github.io/fhir-server/docs/administration/deployment/)** to build from source and run against your own PostgreSQL.

## Documentation

Full documentation lives at **[wso2.github.io/fhir-server/docs](https://wso2.github.io/fhir-server/docs/)**:

- **[FHIR API](https://wso2.github.io/fhir-server/docs/api/interactions/)** — interactions, [search](https://wso2.github.io/fhir-server/docs/api/search/), [conditional operations](https://wso2.github.io/fhir-server/docs/api/conditional/), and [operations](https://wso2.github.io/fhir-server/docs/api/operations/).
- **[Profiles & Conformance](https://wso2.github.io/fhir-server/docs/conformance/implementation-guides/)** — Implementation Guides, [resource types](https://wso2.github.io/fhir-server/docs/conformance/resource-types/), [validation](https://wso2.github.io/fhir-server/docs/conformance/validation/), and [terminology](https://wso2.github.io/fhir-server/docs/conformance/terminology/).
- **[Administration](https://wso2.github.io/fhir-server/docs/administration/deployment/)** — deployment, [configuration](https://wso2.github.io/fhir-server/docs/administration/configuration/), and [multi-tenancy](https://wso2.github.io/fhir-server/docs/administration/multi-tenancy/).
- **[Performance Tuning](./docs/performance-tuning.md)** — sizing rules, tunables, and regression gates.

## Join the Community & Contribute

We'd love for you to be part of the project! Whether you're fixing a bug, improving documentation, or suggesting new features, every contribution counts.

- **[Contributor Guide](./CONTRIBUTING.md)** — learn how to get started.
- **[Testing Guide](https://wso2.github.io/fhir-server/docs/contributing/testing/)** — run the unit and integration test suites.
- **[Report an Issue](https://github.com/wso2/fhir-server/issues)** — help us improve the server.
- **[Security Policy](./SECURITY.md)** — how to report vulnerabilities responsibly.

## License

WSO2 FHIR Server is licensed under Apache 2.0. See the **[LICENSE](./LICENSE)** file for full details.
