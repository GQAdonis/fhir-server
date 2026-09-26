# fhir-guards plugin (Kimi Code, MiniMax Code)

Kimi Code and MiniMax Code load hooks only from **user-installed** plugins, not from the project. This package brings the repo's protected-path guard and metadata-only ledger to them. The rules stay in the repo, and `hooks/run.mjs` runs the project's own `.claude/hooks/dist/harness-hook.mjs`, so updating the repo updates the behaviour.

**Security:** the plugin fires in every project you open. To keep an arbitrary cloned repository from running code through it, `hooks/run.mjs` runs a project's adapter **only for repositories on your allowlist** (its git top level, compared by canonical real path; an allowlist file inside the repo itself is ignored). The allowlist file is `$FHIR_GUARDS_CONFIG`, or `%APPDATA%/fhir-guards/roots.json` on Windows, or `$XDG_CONFIG_HOME` (default `~/.config`)`/fhir-guards/roots.json`.

Install once per machine:

- **Kimi Code:** `/plugins install <repo>/scripts/agent-team/plugins/fhir-guards`, then `/reload`. Kimi hooks are **fail-open**: a crashing or timed-out hook allows the call.
- **MiniMax Code:** `mcode plugin install <repo>/scripts/agent-team/plugins/fhir-guards` (Claude-compatible plugin format: `.claude-plugin/plugin.json` + `hooks/hooks.json`). Not verified end to end, because MiniMax Code needs a login this repo's automation does not have.

Then allow this repository (and only repositories you trust):

```bash
node scripts/agent-team/plugins/fhir-guards/hooks/run.mjs --allow "$PWD"   # interactive; add --yes in scripts you control
node scripts/agent-team/plugins/fhir-guards/hooks/run.mjs --list
```

Codex (`.codex/hooks.json`, active once the project and each hook are trusted) and OpenCode (`.opencode/plugins/fhir-guards.js`, auto-loaded) need no install.
