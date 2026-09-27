## 1. Retire

- [x] 1.1 Remove any remaining `fhir-ideation-strategist` / `fhir-knowledge-curator` definitions from all five harness locations and from `.agent-team/roles/`; verify `find` returns none
- [x] 1.2 Update references (tech-lead hand-off map, `docs/agent-team.md` roster with a redirect note, CLAUDE.md/AGENTS.md if named); verify `grep -rn 'fhir-ideation-strategist\|fhir-knowledge-curator'` outside `openspec/changes/archive/`, `.kbd-orchestrator/phases/agent-dev-team/` and `.prometheus/` returns only the redirect note
- [x] 1.3 Verify `lint:agents` (incl. drift check) passes and `openspec validate retire-merged-agents --strict` passes
