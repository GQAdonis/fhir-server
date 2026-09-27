# Third-Party Notices

This repository vendors third-party agent skills under `.agents/skills/`. They are mirrored into `.claude/skills/`, `.opencode/skills/`, `.kimi-code/skills/` and `.minimax/skills/`. Each vendored skill keeps its upstream `LICENSE` file. Provenance (source, pinned commit, license, roles) is recorded in `.agents/skills/SOURCES.json`.

The upstream LICENSE files carry no separate copyright line. Copyright holders below are the publishing GitHub accounts.

## healthcare-agents

- Source: https://github.com/ajhcs/healthcare-agents
- Commit: `81b239763c06a71f6290d01f2535431c5ae4d89c`
- Copyright: the healthcare-agents contributors (GitHub `ajhcs`)
- License: Apache License 2.0 (`.agents/skills/healthcare-agents/LICENSE`)
- Modified: yes. See `.agents/skills/healthcare-agents/MODIFICATIONS.md` (bundle layout and path rewrites only). The project added `VENDOR-NOTES.md` (PHI precedence note).

## fhir-software

- Source: https://github.com/PhenoML/ClaudeFHIRSkill (formerly `TopologyHealth/ClaudeFHIRSkill`)
- Commit: `f472b762acd0511da892963ec940431f5d57c58a`
- Copyright: PhenoML (GitHub `PhenoML`)
- License: Apache License 2.0 (`.agents/skills/fhir-software/LICENSE`)
- Modified: no. Plugin packaging files (`.claude-plugin/`, `.gitignore`) were not vendored. The project added `VENDOR-NOTES.md` (usage restrictions).

## Not vendored

`anthropics/healthcare` has no license file, so it is used only as a Claude Code plugin (`healthcare@healthcare`; the marketplace is registered in `.claude/settings.json` and each developer opts in to the plugin) and is not redistributed here.
