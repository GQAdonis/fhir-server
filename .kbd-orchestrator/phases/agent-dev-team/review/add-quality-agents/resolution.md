# Review resolution: add-quality-agents

**Round 1 (BLOCK, 1 CRITICAL + 1 WARNING).** Lint was not part of the gate. Fixed: `make lint` was added to the validator's Go command set, and the reviewer now runs build, vet, test and lint.

**Round 2 (BLOCK, 2 CRITICAL).** "Read-only" was imprecise.
- `npm run build` rewrites the tracked `dist/`, and `make build` writes `./fhir-server` into the repo.
- Fixed: read-only now means *never modify tracked files*. The validator uses `check:dist` (compiles to a temp dir) and `go build ./...`, and runs `npm ci` only when the gitignored `node_modules/` is missing.
- The validator no longer preloads `openspec-verify-change`, whose instructions include write steps. It is invoke-when-needed, restricted to read-only subcommands.

**Round 3 (BLOCK, 3 CRITICAL + 1 WARNING).**
- **Policy tightened: an unverified lint BLOCKs.** Archive requires a local `make lint` pass or recorded green-CI evidence (constraint `golangci-lint-clean` is blocking). Operator action: install golangci-lint locally.
- The header check now also requires each touched `.go` file to open with the WSO2 header.
- The tech-lead's `make build` was replaced with `go build ./...`.

**Round 4: PASS.** WARNING: `fhir-tech-lead.md` was edited in this change. This is intentional: the tech-lead's archive rule must match the validator gate defined here. Recorded, not split.

Side finding: `./fhir-server` (the `make build` output) is not gitignored. Left for `fhir-infra-release-engineer` as follow-up debt (it is not in this change's scope).
