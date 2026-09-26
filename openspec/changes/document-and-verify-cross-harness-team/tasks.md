## 1. Documentation

- [ ] 1.1 Rewrite `docs/agent-team.md` (14-role roster, harness × tier model table, PHI-lane rules, hook capability matrix, per-harness limitations, prerequisites block); verify `lint:agents` passes and every role and harness is referenced
- [ ] 1.2 Update `CLAUDE.md` Agent-team section and regenerate `AGENTS.md`; update `.kbd-orchestrator/project.json` `agents_config`/`preferred_execution_agents` for the five harnesses; verify drift check and kbd-init validator pass

## 2. CI

- [ ] 2.1 Extend `.github/workflows/agent-tooling.yml` with manifest validate, ownership/card checks, drift check, and phi-lane-guard tests (paths filter adds `.agent-team/**`, `.codex/**`, `.opencode/**`, `.kimi-code/**`, `.minimax/**`, `AGENTS.md`); verify all steps pass locally and via PR run on 3 OSes

## 3. Acceptance

- [ ] 3.1 Run per-harness smoke prompts for the 5 domain roles on synthetic data (Claude, Codex, OpenCode, Kimi headless; MiniMax file presence/listing); verify results recorded in evidence with exit codes
- [ ] 3.2 Run the phase goal check via `fhir-conformance-validator` (including re-checking the three unvetted plan round-2 fixes); verify G1–G7 MET or gaps recorded
