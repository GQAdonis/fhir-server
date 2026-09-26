import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ledgerDir, ledgerPath, monthKey, partitionLedgerLines } from "../dist/lib/ledger.mjs";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "rotate-ledger.mjs");

const line = (ts, event = "SubagentStart") => JSON.stringify({ ts, event, session_id: "s1" });

test("monthKey extracts a UTC yyyy-mm, or undefined for an unparseable ts", () => {
  assert.equal(monthKey("2026-08-15T00:00:00.000Z"), "2026-08");
  assert.equal(monthKey("2026-01-01T00:00:00.000Z"), "2026-01");
  assert.equal(monthKey("not-a-date"), undefined);
});

test("partitionLedgerLines moves lines strictly before the given month, keeps the rest, and never drops an unparseable line", () => {
  const lines = [line("2026-07-01T00:00:00.000Z"), line("2026-08-15T00:00:00.000Z"), line("2026-09-01T00:00:00.000Z"), "{torn", ""];
  const { rotated, kept } = partitionLedgerLines(lines, "2026-09");
  assert.deepEqual([...rotated.keys()].sort(), ["2026-07", "2026-08"]);
  assert.equal(rotated.get("2026-07").length, 1);
  assert.equal(rotated.get("2026-08").length, 1);
  assert.equal(kept.length, 2, "the current-month line and the torn line both stay");
  assert.ok(kept.includes("{torn"));
});

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "rotate-ledger-"));
  mkdirSync(path.join(root, ".prometheus"), { recursive: true });
  return root;
}

function run(root, args = []) {
  return spawnSync(process.execPath, [cli, root, ...args], { encoding: "utf8" });
}

test("CLI moves lines verbatim and in order into ledger/<yyyy-mm>.jsonl, appending to an existing file", () => {
  const root = sandbox();
  try {
    const lines = [line("2026-07-01T00:00:00.000Z", "SubagentStart"), line("2026-07-02T00:00:00.000Z", "SubagentStop"), line("2026-09-01T00:00:00.000Z", "SubagentStart")];
    writeFileSync(ledgerPath(root), `${lines.join("\n")}\n`);
    mkdirSync(ledgerDir(root), { recursive: true });
    writeFileSync(path.join(ledgerDir(root), "2026-07.jsonl"), `${line("2026-07-01T00:00:00.000Z", "UserPromptSubmit")}\n`);

    const r = run(root, ["--before", "2026-09"]);
    assert.equal(r.status, 0, r.stderr);

    const julyFile = readFileSync(path.join(ledgerDir(root), "2026-07.jsonl"), "utf8").trim().split("\n");
    assert.deepEqual(julyFile, [line("2026-07-01T00:00:00.000Z", "UserPromptSubmit"), lines[0], lines[1]], "appended after the existing content, in order");

    const remaining = readFileSync(ledgerPath(root), "utf8").trim().split("\n");
    assert.deepEqual(remaining, [lines[2]]);

    const cursor = JSON.parse(readFileSync(path.join(root, ".prometheus", ".flush-cursor"), "utf8"));
    assert.equal(cursor.offset, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI is a no-op when nothing is before the cutoff, and leaves an existing cursor untouched", () => {
  const root = sandbox();
  try {
    writeFileSync(ledgerPath(root), `${line("2026-09-01T00:00:00.000Z")}\n`);
    writeFileSync(path.join(root, ".prometheus", ".flush-cursor"), JSON.stringify({ offset: 42 }));
    const r = run(root, ["--before", "2026-09"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /nothing to rotate/);
    assert.equal(JSON.parse(readFileSync(path.join(root, ".prometheus", ".flush-cursor"), "utf8")).offset, 42);
    assert.equal(existsSync(ledgerDir(root)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI does nothing when there is no ledger file, and rejects a malformed --before", () => {
  const root = sandbox();
  try {
    const r = run(root);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /nothing to rotate/);
    const bad = run(root, ["--before", "not-a-month"]);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /yyyy-mm/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
