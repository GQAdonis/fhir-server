## 1. Shared prompt contract

- [x] 1.1 Vendor `karpathy-guidelines` into `.claude/skills/karpathy-guidelines/` with a source/re-sync note; verify `SKILL.md` frontmatter parses and matches the user-level copy

## 2. Agents

- [x] 2.1 Write `.claude/agents/fhir-tech-lead.md` (opus; Agent + read/inspect tools, with Bash limited by prompt to KBD/OpenSpec/git-read/make-verify commands and Edit/Write disallowed; owns execute/status/goal-check/next-phase; hand-off map to all `fhir-*` personas); verify YAML frontmatter parses and every listed skill resolves locally or is noted as a prerequisite
- [x] 2.2 Write `.claude/agents/fhir-ideation-strategist.md` (opus; read + web research; owns new-phase/goal, brainstorming, idea-refine, validate-idea, openspec-explore); verify frontmatter parses and skills resolve
- [x] 2.3 Write `.claude/agents/fhir-architect.md` (opus; design-path writes; owns assess/analyze/plan and OpenSpec authoring; cites DESIGN.md sections); verify frontmatter parses and skills resolve

## 3. Smoke

- [x] 3.1 Invoke each of the three agents through the Agent tool with a one-line role-confirmation prompt; verify each replies naming its owned KBD stages and no errors are reported for its frontmatter
