## Context

Subagent frontmatter supports `name`, `description`, `tools`, `disallowedTools`, `model`, `skills`, `effort`, `isolation`, `color`, `memory` and more. Project agents take precedence over user-level agents. Subagents may spawn subagents up to three levels deep. Decision D-001 sets the `fhir-` prefix and D-004 sets document-plus-degrade for skills.

## Goals / Non-Goals

**Goals:** a reusable prompt skeleton; clear ownership of KBD stages; minimal tool grants.

**Non-Goals:** agent-scoped hooks (all hooks are project-level; see plan); `memory:` scopes, since Karpathy logging is the memory channel.

## Decisions

- **Prompt skeleton (shared by all 11 agents).**
  - Sections, in order: Role; Owns (KBD stages and paths); Domain rules (with `DESIGN.md §` citations); Workflow; Hand-offs; Skills (missing-skill rule); Karpathy; Output contract.
  - It is kept textually identical across agents so the lint in change 8 can check that the required headings are present.
- **Tool grants:**
  - Tech lead: `Agent, Read, Grep, Glob, Bash, SendMessage`, with `disallowedTools: Edit, Write`. It delegates rather than implements.
  - Ideation: `Read, Grep, Glob, WebSearch, WebFetch` plus the Firecrawl MCP search and scrape tools.
  - Architect: `Read, Grep, Glob, Bash, Write, Edit`, limited by prompt to design paths, because the tools field can't express a path scope.
- **Preload only repo-resident skills.** Adopted after adversarial review of this change. Preloading via `skills:` cannot degrade when a skill is missing on a fresh clone, so frontmatter lists only skills that live in `.claude/skills/`: the vendored `karpathy-guidelines` and the OpenSpec skills from `openspec init`. Machine-local skills are named under *Invoke when needed* in the prompt, where the missing-skill rule applies. This rule applies to all 11 agents.
- **Tech lead keeps Bash.** Adopted after review. It must run the `kbd-apply.sh` driver and `prometheus kbd` commands. File mutation is prevented structurally by `disallowedTools: Edit, Write`, and shell use is limited by the prompt to KBD, OpenSpec, git-read and make-verify commands.
- **Vendoring `karpathy-guidelines`** copies the user-level skill verbatim, with a `source:` note in the README for re-syncing. It is small and MIT-licensed.

## Risks / Trade-offs

- [Architect path scope is prompt-enforced only] → the code-reviewer persona flags any architect-authored `.go` diff, and the guardrail hooks protect generated files regardless.
- [Opus cost] → accepted in D-002. Descriptions are written narrowly so these agents are delegated to only for their stages.
