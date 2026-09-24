## 1. Documentation

- [x] 1.1 Write `docs/agent-team.md` (roster + model rationale, persona→KBD/skill matrix, hand-off diagram, prerequisites YAML block of machine-local skills with source packs, Karpathy data flow + PHI policy, Windows/Git Bash note for KBD stage hooks); verify every `fhir-*` agent file is referenced and every non-vendored skill appears in the prerequisites block
- [x] 1.2 Add an "Agent team" section to `CLAUDE.md` (pointer to the doc, `claude --agent fhir-tech-lead`, hook build commands) and align `.kbd-orchestrator/project.json` `model_policy.registry` and `preferred_*` with the roster; verify `node .claude/hooks/dist/lint-agents.mjs` and `jq . .kbd-orchestrator/project.json` succeed and the kbd-init validator still passes

## 2. Agent lint

- [x] 2.1 Implement `src/lint-agents.mts` and `lint:agents` npm script (frontmatter subset parser, model alias check, skills resolved-or-documented, required prompt headings); verify tests fail on a fixture with an unknown skill and pass on the real `.claude/agents/`

## 3. Cross-platform CI

- [ ] 3.1 Add `.github/workflows/agent-tooling.yml` (ubuntu/macos/windows matrix, Node 24, SHA-pinned checkout/setup-node, paths filter; npm ci, build, test, check:dist, lint:agents, scan:prometheus, exec-form fixture run); verify locally with `node` for each step and via a pushed branch run showing all three OS jobs green

## 4. Team acceptance

- [x] 4.1 Verify all 11 `fhir-*` agents appear in Claude Code's agent list for this repo and each answers a role-confirmation prompt; record the result in `.kbd-orchestrator/phases/agent-dev-team/evidence/`
- [ ] 4.2 Run `/kbd-goal-check agent-dev-team`; verify G1–G5 and constraints C1–C2 report MET, or record the remaining gaps as reflection inputs
