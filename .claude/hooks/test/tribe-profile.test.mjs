// Structural checks for the Tribe-lane harness profiles (change
// `configure-phi-lanes`, task 4.1, carried from the define-portable-team-
// manifest security review): on a real PHI session, off-lane channels must be
// denied, not just discouraged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function readJson(rel) {
  return JSON.parse(readFileSync(path.join(repo, rel), "utf8"));
}

test("Claude Tribe profile denies WebFetch, WebSearch and every mcp__* tool", () => {
  const settings = readJson(".claude/settings.tribe.json");
  assert.deepEqual(settings.permissions.deny.sort(), ["WebFetch", "WebSearch", "mcp__*"].sort());
});

test("Claude Tribe profile disables the plugin marketplace, minimizes retention and disables nonessential traffic", () => {
  const settings = readJson(".claude/settings.tribe.json");
  assert.deepEqual(settings.extraKnownMarketplaces, {}, "no marketplace (e.g. healthcare) should be registered on a Tribe session");
  assert.equal(settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, "1");
  assert.ok(typeof settings.cleanupPeriodDays === "number" && settings.cleanupPeriodDays <= 1, "transcript retention should be minimized");
});

test("Claude Tribe profile disables the Karpathy Stop/SessionEnd/PreCompact sinks but keeps the metadata-only ledger and guards", () => {
  const settings = readJson(".claude/settings.tribe.json");
  for (const event of ["Stop", "SessionEnd", "PreCompact"]) {
    assert.equal(settings.hooks[event], undefined, `${event} (karpathy-flush) writes session-note text and must be off on a Tribe session`);
  }
  const preToolUseHooks = settings.hooks.PreToolUse.flatMap((m) => m.hooks.flatMap((h) => h.args));
  assert.ok(preToolUseHooks.some((a) => a.endsWith("guard-generated.mjs")));
  assert.ok(preToolUseHooks.some((a) => a.endsWith("phi-lane-guard.mjs")));
  assert.ok(settings.hooks.SubagentStart[0].hooks[0].args[0].endsWith("agent-ledger.mjs"), "the metadata-only ledger stays on");
});

test("the Codex Tribe template denies shell network access (off-lane channel)", () => {
  const text = readFileSync(path.join(repo, ".codex/config.phi.template.toml"), "utf8");
  assert.match(text, /\[sandbox_workspace_write\][^[]*network_access\s*=\s*false/s);
});

test("the OpenCode Tribe template denies its web-fetch tool", () => {
  const config = readJson(".opencode/opencode.phi.template.json");
  assert.equal(config.permission.webfetch, "deny");
});

test("a fixture WebFetch call on a Tribe profile is blocked by the PHI-lane guard when the lane is not proven", async () => {
  const { deniedUrl, parseSandboxes } = await import("../dist/lib/phi-lane.mjs");
  const allowlist = parseSandboxes(undefined);
  // The profile denies WebFetch outright (checked above); this exercises the
  // same-shaped call through the cooperating guard hook, which fails closed
  // even if a permission entry were ever missing or overridden.
  assert.equal(deniedUrl("WebFetch", { url: "https://ehr.example.com/fhir/Patient/1" }, allowlist, {}), "https://ehr.example.com/fhir/Patient/1");
});
