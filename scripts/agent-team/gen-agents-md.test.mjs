// Tests for gen-agents-md.mjs: node --test scripts/agent-team/gen-agents-md.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { agentsMd } from "./gen-agents-md.mjs";

const claude = "# CLAUDE.md\n\nThis file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.\n\nBody stays.\n";

test("only the title and lead line change", () => {
  const out = agentsMd(claude);
  assert.match(out, /^# AGENTS\.md\n\nThis file provides guidance to AI coding agents that read `AGENTS.md`/);
  assert.match(out, /\n\nBody stays\.\n$/);
  assert.doesNotMatch(out, /claude\.ai\/code/);
});

test("output is identical for CRLF input", () => {
  assert.equal(agentsMd(claude.replace(/\n/g, "\r\n")), agentsMd(claude));
});

test("fails loudly when CLAUDE.md's title or lead line changes", () => {
  assert.throws(() => agentsMd("# Other\n"), /must start with/);
  assert.throws(() => agentsMd("# CLAUDE.md\n\nNew lead.\n"), /lead line changed/);
});
