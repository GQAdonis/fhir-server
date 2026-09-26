# Manifest build evidence (task 3.2)

agent-team-creator: worktree build `prometheus-skill-pack/.worktrees/agent-team-creator` @ `5f2d7a712f289b6bb2df3f45138bb3d68ed836a2`. CLI: `node <skill>/scripts/cli.mjs`.

| Step | Command | Result |
|---|---|---|
| Build | `node scripts/agent-team/build-manifest.mjs` | wrote `.agent-team/team.json` (14 roles); a second run is byte-identical (see `shasum -a 256 .agent-team/team.json`; the value changes whenever a role changes) |
| Checks | `AGENT_TEAM_CREATOR=<skill dir> node scripts/agent-team/build-manifest.mjs --check` | Always runs `agent-team-creator validate` on the built manifest and fails if it is missing or reports errors (a seeded unknown dependency fails with "Unknown dependency no-such-role"). `--skip-validate` is an explicit offline opt-out that prints a warning. Also OK: OK: disjoint ownership, review roles own only their findings path, prompt Writable paths agree with owns, skills resolve (repo-resident or documented prerequisite), PHI-lane block and a five-harness card on every role, team.json up to date |
| Validate | `cli.mjs validate` on `{team}` | `{"valid":true}` |
| Guide | `cli.mjs guide`, intake areas code/security/docs/product with an ownership map | `ready: true`, but the proposed roles are generic (`implementer`, `security-reviewer`, `documentation-specialist`, `product-manager`, `reviewer`). The guide has no healthcare, integration or billing areas, so the 14-role team is authored through the skill's documented expert path (a manifest supplied directly), as planned. |
| Init | `cli.mjs init`, state `.agent-team/local/state.json` | revision 0; the state file is mode 600 and gitignored (`.agent-team/local/`), because it contains prompts |
| Tests | `node --test scripts/agent-team/build-manifest.test.mjs` | 18/18 pass (after review rounds 1–15 and persona reviews: native wrappers, per-harness tools, owns statements, list parsing, review-role findings paths, doc roster, used_by reverse check, tribe-only lane text) |

## Seeded-fault checks on the real tree (task 3.3)

Each fault was applied to a copy, then restored.

| Seeded fault | Result |
|---|---|
| `data-sync-coordinator` owns `docs/**` | exit 1: three ownership overlaps named (architect `docs/*.md` and `docs/images/**`, hipaa `docs/compliance/**`) |
| invoke skill `made-up-skill` | exit 1: "neither repo-resident nor in docs/agent-team.md prerequisites" |
| preloaded skill `not-installed` | exit 1: "preloaded skill … is not repo-resident" |
| hand-edited `team.json` (a stripped prompt) | exit 1: "team.json is out of date". The generated card and PHI block cannot be removed without drift. Their absence in a rebuilt manifest is covered by the unit test `cardProblems flags a prompt without the generated sections`. |
| restored tree | `build-manifest: OK (14 roles)` |
| review role owns an extra path (`fhir-code-reviewer` + `docs/review/**`) | exit 1: "review role must own only \".agent-team/findings/fhir-code-reviewer/**\"" |
| `docs/agent-team.md` roster row removed (`data-sync-coordinator`) | exit 1: "docs/agent-team.md roster (…) differs from the manifest roster (…)" |
