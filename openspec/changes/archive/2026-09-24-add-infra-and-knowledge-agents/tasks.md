## 1. Agents

Skill placement (per the phase rule adopted in add-architecture-agents review: frontmatter `skills:` preloads only repo-resident skills; machine-local skills listed below are named under 'Invoke when needed' in the prompt).

- [x] 1.1 Write `.claude/agents/fhir-infra-release-engineer.md` (sonnet; edit scope `.github/`, `helm/`, `Dockerfile`, `docker-compose.yml`, CI-invoked `Makefile` targets and build-output `.gitignore` lines; never `version.txt`; SHA-pin rule noting current `release.yml` tag-pinned `actions/checkout@v4` and `actions/setup-go@v5` as known debt; CI/make parity; helm placeholder; ci-cd-and-automation, github-ops, gitops-bootstrap, kustomize-overlay, deployment-patterns, shipping-and-launch); verify frontmatter parses, preloaded skills are repo-resident, and every skill named in the prompt resolves locally or is a documented prerequisite
- [x] 1.2 Write `.claude/agents/fhir-knowledge-curator.md` (haiku; writes only `.prometheus/{raw,outbox,ledger}/`, and during rotation `agent-ledger.jsonl` and `.flush-cursor`, plus the `reflection.md` Karpathy section; ledger schema summary, flush/outbox, rotation, scan-before-commit; karpathy-progress-memory, kbd-reflect, llm-wiki, continuous-learning-v2, kbd-memory-recall); verify frontmatter parses, preloaded skills are repo-resident, and every skill named in the prompt resolves locally or is a documented prerequisite

## 2. Smoke

- [x] 2.1 Give `fhir-knowledge-curator` a fixture ledger of five lines; verify it produces a session summary with no prompt/tool content and runs `npm --prefix .claude/hooks run scan:prometheus` with exit 0
