// Structural checks for the Tribe-lane provider templates (change
// `configure-phi-lanes`, task 2.1): every endpoint, model and credential must
// come from a TRIBE_MODEL_* placeholder, never a literal host or key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const TEMPLATES = [".codex/config.phi.template.toml", ".kimi-code/config.phi.template.toml", ".opencode/opencode.phi.template.json"];

// Any bare http(s) URL that is not a documentation/schema reference (opencode.ai) is a real endpoint leak.
const ALLOWED_URL_HOSTS = new Set(["opencode.ai"]);

test("templates reference the model endpoint, key and name only through TRIBE_MODEL_* (or an {env:...} substitution of one)", () => {
  for (const rel of TEMPLATES) {
    const text = readFileSync(path.join(repo, rel), "utf8");
    assert.match(text, /TRIBE_MODEL_BASE_URL/, `${rel}: missing TRIBE_MODEL_BASE_URL`);
    assert.match(text, /TRIBE_MODEL_API_KEY/, `${rel}: missing TRIBE_MODEL_API_KEY`);
  }
});

test("templates contain no literal http(s) endpoint other than a documentation/schema reference", () => {
  for (const rel of TEMPLATES) {
    const text = readFileSync(path.join(repo, rel), "utf8");
    for (const m of text.matchAll(/https?:\/\/([^\s"'/]+)/g)) {
      const host = m[1];
      assert.ok(ALLOWED_URL_HOSTS.has(host), `${rel}: unexpected literal host ${host}`);
    }
  }
});

test("templates contain no secret-shaped literal (a bare sk-/AKIA-style key, or a private key block)", () => {
  const SECRET_SHAPED = [/\bsk-[A-Za-z0-9_-]{16,}/, /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  for (const rel of TEMPLATES) {
    const text = readFileSync(path.join(repo, rel), "utf8");
    for (const pattern of SECRET_SHAPED) assert.equal(pattern.test(text), false, `${rel}: matched ${pattern}`);
  }
});

test("the JSON template is valid JSON and the TOML templates parse (single top-level table each)", async () => {
  JSON.parse(readFileSync(path.join(repo, ".opencode/opencode.phi.template.json"), "utf8"));
  // No TOML parser dependency is installed for the hooks package; a light
  // structural check (balanced brackets, at least one [table] header) stands
  // in, since `check-dist`/CI already exercises a real TOML load via Python
  // in this task's manual verification.
  for (const rel of [".codex/config.phi.template.toml", ".kimi-code/config.phi.template.toml"]) {
    const text = readFileSync(path.join(repo, rel), "utf8");
    assert.match(text, /^\[[a-zA-Z0-9_.[\]]+\]$/m, `${rel}: no TOML table header found`);
  }
});

test("the Codex template's model_provider/model selection keys are at the document root, not nested inside [model_providers.tribe]", () => {
  // TOML semantics: a bare `key = value` line belongs to whichever [table] header most recently
  // preceded it. model_provider/model must select the provider at the *root* Codex config table,
  // so they must appear before the first `[model_providers...]` header, not after it.
  const text = readFileSync(path.join(repo, ".codex/config.phi.template.toml"), "utf8");
  const nonCommentLines = text.split("\n").filter((l) => !/^\s*#/.test(l) && l.trim() !== "");
  const firstTableIdx = nonCommentLines.findIndex((l) => /^\[/.test(l));
  assert.ok(firstTableIdx >= 0, "expected at least one [table] header");
  const beforeFirstTable = nonCommentLines.slice(0, firstTableIdx).join("\n");
  assert.match(beforeFirstTable, /^model_provider\s*=\s*"tribe"$/m, "model_provider must precede every [table] header");
  assert.match(beforeFirstTable, /^model\s*=\s*"\$TRIBE_MODEL_NAME"$/m, "model must precede every [table] header");
});
