## Why

An agent team that is undocumented and unverified will drift. Contributors need to know the roster, why each model was chosen, which KBD and supporting skills each persona uses, and which machine-level skills they must install. The whole setup, including the cross-platform hook claim, needs a machine check on macOS, Linux and Windows.

## What Changes

- Add `docs/agent-team.md` covering:
  - the roster and model rationale;
  - the persona → KBD stage / skill matrix;
  - the hand-off diagram;
  - the prerequisites table of the 43 machine-local skills with their source packs;
  - the Karpathy logging data flow and PHI policy;
  - the Windows note that KBD stage hooks need Git Bash (decision D-005).
- Add an "Agent team" section to `CLAUDE.md` pointing to the doc.
- Align `.kbd-orchestrator/project.json` `model_policy` and `preferred_*` fields with the roster.
- Add `lint-agents`, a Node check of every `.claude/agents/fhir-*.md`: frontmatter, model alias, tools, skills resolution or prerequisite listing, and required prompt headings.
- Add a `.github/workflows/agent-tooling.yml` matrix (ubuntu, macos, windows; Node 24; SHA-pinned actions). It runs `npm ci`, `build`, `test`, `check:dist`, `lint-agents` and `scan:prometheus`, and pipes a hook fixture through `node` to prove exec form on Windows.

## Capabilities

### New Capabilities
- `agent-team/team-verification`: the documentation contract and the automated checks that keep the agent team and its hooks valid on every platform.

### Modified Capabilities

## Impact

- New `docs/agent-team.md` and `.github/workflows/agent-tooling.yml`; edits to `CLAUDE.md` and `.kbd-orchestrator/project.json`.
- CI minutes: three short Node jobs per push or PR touching agent tooling.
