## 1. Model discovery and ownership map

- [x] 1.1 Run `agent-team-models` discovery per harness (Claude, Codex, OpenCode, Kimi, MiniMax) and record concrete model ids per tier in `evidence/model-map.md`; verify every tier (hard/medium/low) has an entry for every harness or an explicit "ignored by harness" note
- [x] 1.2 Create owned doc paths `docs/integrations/`, `docs/sync/`, `docs/billing/`, `docs/compliance/` with README stubs stating owner role and PHI rule; verify files exist and contain no PHI (scan)

## 2. Role catalog

- [x] 2.1 Port the 9 kept engineering prompts into `.agent-team/roles/<id>.md` (header + body), folding ideation into architect and curation into tech-lead; verify a recorded diff against the original `.claude/agents` bodies shows only the intended merge edits
- [x] 2.2 Author the 5 domain role files (`hipaa-privacy-officer`, `fhir-integration-specialist`, `ehr-integration-manager`, `data-sync-coordinator`, `billing-prior-auth-specialist`) with domain rules, hand-offs, owned paths and bound skills; verify each cites its skills from `install-domain-skills`

## 3. Build and validate

- [x] 3.1 Implement `scripts/agent-team/build-manifest.mjs` (roles → `team.json`, renders PHI-lane block + Harness card) with `node:test` tests; verify tests pass and output is deterministic (two runs byte-identical)
- [x] 3.2 Build `.agent-team/team.json`, run `cli.mjs validate` and `guide` (with the ownership map → `ready: true`), and `cli.mjs init` to create local state; verify all three succeed and record output in evidence
- [x] 3.3 Add checks: disjoint ownership, skills resolve, every role has PHI-lane block and 5-harness Harness card; verify the checks fail on seeded bad fixtures and pass on the real manifest
