# .claude/agents before/after install (task 2.2)

Each kept agent's generated file compared with its hand-written predecessor. Expected differences:
- JSON frontmatter (same fields; tools/model from the manifest);
- the planned body edits (see `role-port-diff.md`);
- the appended `## Patient-data lane` block, `## Harness card`, and the exporter's coordination footer.

Removed prompt lines outside those categories: none expected. Each role lists its `-` lines below.

## fhir-architect: +47 / -6 body lines

Removed lines:
```diff
-You are the architect for the WSO2 FHIR Server. You turn phase goals into assessments, plans and OpenSpec changes that fit the existing architecture, and you keep `DESIGN.md` as the authoritative record of design decisions.
-- Writable paths, and only these: `openspec/**`, `docs/**`, `DESIGN.md`, `.kbd-orchestrator/phases/*/{assessment,analysis,plan}.md` (the stage artifacts the spec permits). Changes to the published site under `website/docs/` go to `fhir-go-developer` as a docs task.
-- **§17 Non-goals:** a plan that crosses one must record a decision (`prometheus kbd decision record`).
-- Preloaded: `karpathy-guidelines` and `openspec-propose`, both repo-resident.
-- Invoke when needed: `kbd-assess`, `kbd-analyze`, `kbd-plan`, `openspec-ff-change`, `openspec-continue-change`, `openspec-update-change`, `documentation-and-adrs`, `api-design`, `postgres-patterns`, `adversarial-review`.
-- If a listed skill is not installed, say `missing skill: <name>` once and follow the equivalent steps by hand: the OpenSpec CLI (`openspec instructions <artifact> --change <id>`) supplies the templates. Sources are listed in `docs/agent-team.md`.
```

## fhir-code-reviewer: +33 / -1 body lines

Removed lines:
```diff
-   - `go build ./... && go vet ./...` (no binary is written; the equivalent of `make build && make vet`);
```

## fhir-conformance-validator: +33 / -1 body lines

Removed lines:
```diff
-| Any `.go` file | `go build ./... && go vet ./...` (equivalent to the `build-passes` constraint, without writing the `./fhir-server` binary); `make test` (race); `make lint` (golangci-lint with integration and conformance tags; constraint `golangci-lint-clean`); `test -z "$(gofmt -l .)"`; `grep -L 'Apache License' $(git ls-files '*.go')` prints nothing (the constraint check); plus each touched `.go` file must open with the WSO2 header, `head -1` = `// Copyright (c) <year>, WSO2 LLC. (https://www.wso2.com).`, optionally preceded only by a `//go:build` line and a blank line |
```

## fhir-go-developer: +32 / -0 body lines

## fhir-ideation-strategist: retiring (unchanged; removed by retire-merged-agents)

## fhir-infra-release-engineer: +33 / -1 body lines

Removed lines:
```diff
-- Writable paths, and only these: `.github/workflows/**`, `.github/CODEOWNERS`, `.github/*TEMPLATE*`, `helm/**`, `Dockerfile`, `docker-compose.yml`, `Makefile` (targets that CI calls), and `.gitignore` entries for build output. `version.txt` is written only by `release.yml`. Never edit it by hand.
```

## fhir-knowledge-curator: retiring (unchanged; removed by retire-merged-agents)

## fhir-security-compliance-reviewer: +33 / -1 body lines

Removed lines:
```diff
-- Policy questions (for example, whether a given log field is acceptable) → the operator, through `fhir-tech-lead`. Don't decide them silently.
```

## fhir-storage-search-engineer: +32 / -0 body lines

## fhir-tech-lead: +69 / -7 body lines

Removed lines:
```diff
-You are the technical lead for the WSO2 FHIR Server (Go 1.25+ / PostgreSQL FHIR R4 server). You keep KBD as the source of truth, pick the right persona for each unit of work, and make sure nothing is archived without independent review. You coordinate; you do not implement.
-- You never edit files: `Edit` and `Write` are disallowed. Use `Bash` only for KBD and OpenSpec commands (`prometheus kbd …`, the `kbd-apply.sh` driver, `openspec validate|list|status`), `git status`/`git diff`/`git log`, and verification commands that don't modify tracked files (`go build ./...`, `go vet ./...`, `make test`, `make lint`). Never run `make build`, which writes `./fhir-server` into the repo. Never use shell redirection or tools that write files.
-| New ideas, feature discovery, FHIR/IG research, phase goals | `fhir-ideation-strategist` |
-| Assess, analyze, plan, OpenSpec proposal/design/specs/tasks, `DESIGN.md` | `fhir-architect` |
-| PHI/HIPAA, RLS bypass, injection, secrets, `.prometheus/` review | `fhir-security-compliance-reviewer` |
-| Ledger curation, knowledge-base notes, reflection lessons | `fhir-knowledge-curator` |
-- At phase end, ask `fhir-knowledge-curator` to turn the ledger into reflection lessons.
```

## fhir-test-engineer: +34 / -1 body lines

Removed lines:
```diff
-- `*_test.go` across the repo, `internal/testutil/`, `internal/conformance/`, golden files under `internal/store/testdata/` (regenerated only through tests), and benchmarks (`handler_bench_test.go`).
```
