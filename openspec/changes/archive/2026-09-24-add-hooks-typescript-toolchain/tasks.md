## 1. Package scaffold

- [x] 1.1 Create `.claude/hooks/package.json` (private, `typescript@7.0.2`, `@types/node@^24` devDependencies; scripts `build`, `test`, `check:dist`) and `tsconfig.json` (`module`/`moduleResolution: nodenext`, `target: es2023`, `strict`, `rootDir: src`, `outDir: dist`); verify `npm --prefix .claude/hooks ci` succeeds and `npx --prefix .claude/hooks tsc --version` reports 7.0.2
- [x] 1.2 Add `.claude/hooks/.gitignore` ignoring only `node_modules/`; verify `git check-ignore .claude/hooks/dist/x.mjs` reports no match

## 2. Runtime library

- [x] 2.1 Implement `src/lib/hook-io.mts` (stdin JSON reader, `allow`/`deny`/`feedback`/`context`/`warn` helpers, exit 0/2 semantics, malformed-input → warn + exit 0) and `src/lib/paths.mts` (`projectDir`, `rel`, `toPosix`); verify `npm --prefix .claude/hooks run build` emits `dist/lib/*.mjs`
- [x] 2.2 Add `node:test` suites in `test/` covering malformed stdin, deny exit code, `additionalContext` JSON shape, and Windows-separator normalization; verify `npm --prefix .claude/hooks test` passes

## 3. Freshness guard and settings

- [x] 3.1 Implement `scripts/check-dist.mjs` (compile to a temp outDir, byte-compare with `dist/`, list stale files); verify it exits 0 on a fresh build and non-zero after touching a source without rebuilding
- [x] 3.2 Create `.claude/settings.json` with an empty `hooks` object and a `$schema` reference; verify it parses with `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"`

## 4. Constraint unblock

- [x] 4.1 Add the Apache 2.0 WSO2 header to `internal/config/example_parse_test.go`; verify `grep -L 'Apache License' $(git ls-files '*.go')` prints nothing and `go test ./internal/config/` passes
