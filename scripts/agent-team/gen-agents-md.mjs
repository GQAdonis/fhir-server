#!/usr/bin/env node
// Generate AGENTS.md (read by Codex, OpenCode, Kimi Code and MiniMax Code)
// from CLAUDE.md, so every harness gets the same project instructions. Only
// the title (# AGENTS.md) and the harness-specific lead line change.
//
//   node scripts/agent-team/gen-agents-md.mjs          # write AGENTS.md
//   node scripts/agent-team/gen-agents-md.mjs --check  # exit 1 if AGENTS.md is stale
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLAUDE_TITLE = "# CLAUDE.md";
const CLAUDE_LEAD = "This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.";
const AGENTS_LEAD =
  "This file provides guidance to AI coding agents that read `AGENTS.md` (Codex, OpenCode, Kimi Code, MiniMax Code and others) when working with code in this repository. It is generated from `CLAUDE.md` by `node scripts/agent-team/gen-agents-md.mjs`: edit `CLAUDE.md`, not this file. Agent definitions for each harness are generated from `.agent-team/team.json` (see `docs/agent-team.md`).";

export function agentsMd(claudeMd) {
  const src = claudeMd.replace(/\r\n/g, "\n");
  if (!src.startsWith(`${CLAUDE_TITLE}\n`)) throw new Error(`CLAUDE.md must start with "${CLAUDE_TITLE}"`);
  if (!src.includes(CLAUDE_LEAD)) throw new Error("CLAUDE.md lead line changed; update gen-agents-md.mjs");
  return `# AGENTS.md\n${src.slice(CLAUDE_TITLE.length + 1).replace(CLAUDE_LEAD, AGENTS_LEAD)}`;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const want = agentsMd(readFileSync(path.join(root, "CLAUDE.md"), "utf8"));
  const out = path.join(root, "AGENTS.md");
  if (process.argv.includes("--check")) {
    // Byte-exact (.gitattributes keeps AGENTS.md LF on every platform).
    if (!existsSync(out) || readFileSync(out, "utf8") !== want) {
      console.error("gen-agents-md: AGENTS.md is out of date with CLAUDE.md; run node scripts/agent-team/gen-agents-md.mjs");
      process.exit(1);
    }
    console.log("gen-agents-md: AGENTS.md is current");
    return;
  }
  writeFileSync(out, want);
  console.log("gen-agents-md: wrote AGENTS.md");
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
