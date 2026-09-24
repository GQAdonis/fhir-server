## 1. Agents

Skill placement (per the phase rule adopted in add-architecture-agents review: frontmatter `skills:` preloads only repo-resident skills; machine-local skills listed below are named under 'Invoke when needed' in the prompt).

- [x] 1.1 Write `.claude/agents/fhir-go-developer.md` (sonnet, `isolation: worktree`, full edit tools; golang-patterns, tdd-workflow, karpathy-guidelines, surgical-patch, kbd-apply; verify-before-handoff rule); verify frontmatter parses, preloaded skills are repo-resident, and every skill named in the prompt resolves locally or is a documented prerequisite
- [x] 1.2 Write `.claude/agents/fhir-storage-search-engineer.md` (opus, `effort: high`; all six storage/search rules with DESIGN.md § citations; postgres-patterns, database-migrations); verify each blocking constraint in `.kbd-orchestrator/constraints.md` that touches store/index/db is cited in the prompt
- [x] 1.3 Write `.claude/agents/fhir-test-engineer.md` (sonnet; testutil, build tags, race-integration parity command, UPDATE_GOLDEN, FHIR_TEST_POSTGRES_IMAGE, StoreAPI mock rule; golang-testing, test-driven-development, verification-loop); verify frontmatter parses, preloaded skills are repo-resident, and every skill named in the prompt resolves locally or is a documented prerequisite

## 2. Smoke

- [x] 2.1 Ask `fhir-storage-search-engineer` through the Agent tool how it would handle an unsupported composite search parameter; verify the answer is a fail-closed `UnsupportedParamError` citing DESIGN.md §4
- [x] 2.2 Ask `fhir-test-engineer` for the command that mirrors CI race coverage; verify it returns `go test -race -tags integration -timeout 1200s ./internal/store/... ./internal/handler/...`
