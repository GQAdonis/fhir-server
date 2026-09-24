## Context

Changes 1–7 deliver the hooks and agents. Repo CI already pins actions by SHA in `ci.yml`, and this change follows that. `website/` builds the Docusaurus site from `website/docs/**`, while `docs/agent-team.md` lives in the repo-root `docs/` next to `performance-tuning.md`.

## Goals / Non-Goals

**Goals:** a contributor-facing doc; automated lint; three-OS proof of the exec-form hooks.

**Non-Goals:** publishing the doc to the Docusaurus site; running Claude itself in CI; fixing `release.yml`'s tag-pinned actions (owned by `fhir-infra-release-engineer` as follow-up debt).

## Decisions

- **The prerequisites table is the lint's source of truth** for machine-local skills. It is a fenced YAML block inside `docs/agent-team.md`, which the lint parses, so the doc and the check can't disagree.
- **Workflow trigger:** `paths` filter on `.claude/**`, `.prometheus/**`, `.kbd-orchestrator/hooks-config.json`, `docs/agent-team.md` and the workflow file itself, on push to main and on pull requests. This avoids CI cost on Go-only PRs.
- **Action pins:** reuse the exact `actions/checkout` and `actions/setup-node` SHAs already used in `docs-publish.yml` / `ci.yml`, with `node-version: '24'`.
- **Lint implementation:** `src/lint-agents.mts`, a dependency-free frontmatter parser that handles the YAML subset used by agent files (scalars, inline lists, block lists). This avoids a YAML dependency in a zero-dependency package.

## Risks / Trade-offs

- [CI runners lack the machine-local skills] → the lint accepts documented prerequisites, so CI checks consistency rather than presence.
- [The subset YAML parser rejects valid exotic YAML] → agent files are written in the subset, and the lint error names the unsupported construct.
