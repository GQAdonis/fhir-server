## Context

The repo has no root `package.json`; only `website/` (Docusaurus, Node 20 in CI) has one. Node 24.16 is installed locally. `typescript@latest` is 7.0.2, the Go-native compiler shipped in the mainline package, which exposes `tsc`. The assessment verified that Claude Code's exec form (`command` plus `args`) spawns without a shell.

## Goals / Non-Goals

**Goals:** a self-contained hook package; zero runtime dependencies; reproducible builds; a freshness guard for the committed output.

**Non-Goals:** a bundler; a CommonJS output; hooks for events not used by this phase; making `website/` share the package.

## Decisions

- **Separate package at `.claude/hooks/`, not the repo root.** This keeps the Go repo free of a root `node_modules` and scopes the Node toolchain to agent tooling. The alternative was a root `package.json` with workspaces, rejected because it implies Node for all contributors.
- **`.mts` → `.mjs` under `module: nodenext`.** The file extension alone determines ESM, and no `"type": "module"` guessing is needed. Relative imports are written with `.mjs` extensions, which is what nodenext requires.
- **Commit `dist/`.** Hooks must work on a fresh clone without `npm ci`. Drift is controlled by `scripts/check-dist.mjs`, which compiles into a temp `outDir` and byte-compares against `dist/`. CI runs it in change 8.
- **Tests use `node:test`, run against the compiled `dist/`,** so tests exercise exactly what ships. The alternative, running tests through a TS loader, adds a dependency and could test code that differs from what ships.
- **Library surface** (`src/lib/`):
  - `hook-io.mts`: `readInput()`, `allow()`, `deny(reason)`, `feedback(text)`, `context(text)`, `warn(msg)`.
  - `paths.mts`: `projectDir()`, `rel(path)`, `toPosix(path)`.

## Risks / Trade-offs

- [TypeScript 7 emit differs from 6.x] → pin the exact version (`7.0.2`) and commit `package-lock.json`.
- [Contributors edit `dist/` by hand] → `check:dist` fails in CI. The guardrail hook in change 3 treats `dist/` as generated.
- [`node` missing on PATH on Windows] → documented as a prerequisite in change 8; CI covers `windows-latest`.
