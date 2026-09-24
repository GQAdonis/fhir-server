import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recorderStatus, resolveRecorder } from "../dist/karpathy-boundary.mjs";

const bridge = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "karpathy-boundary.mjs");
const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;

function sandbox() {
  const root = mkdtempSync(path.join(tmpdir(), "boundary-"));
  const home = path.join(root, "home");
  mkdirSync(home);
  return { root, home };
}

function run(root, env, boundary = "task") {
  const r = spawnSync(process.execPath, [bridge, "--boundary", boundary, "--project-root", root], { encoding: "utf8", env });
  const ledger = readFileSync(path.join(root, ".prometheus", "agent-ledger.jsonl"), "utf8").trim().split("\n");
  return { r, last: JSON.parse(ledger[ledger.length - 1]), lines: ledger.length };
}

function isolatedEnv(home, extra = {}) {
  return { PATH: process.env.PATH ?? "", HOME: home, USERPROFILE: home, KBD_ORCHESTRATOR_ROOT: path.join(home, "none"), ...extra };
}

test("recorderStatus reads the last JSON status line", () => {
  assert.equal(recorderStatus('noise\n{"status":"recorded","eventId":"x"}\n'), "recorded");
  assert.equal(recorderStatus("not json"), undefined);
});

test("resolveRecorder honours KARPATHY_RECORDER, then KBD root, then home", () => {
  const { root, home } = sandbox();
  try {
    const viaHome = path.join(home, ".claude", "skills", "karpathy-progress-memory", "scripts");
    mkdirSync(viaHome, { recursive: true });
    writeFileSync(path.join(viaHome, "record-progress.py"), "");
    const explicit = path.join(root, "explicit.py");
    writeFileSync(explicit, "");
    assert.equal(resolveRecorder({ KARPATHY_RECORDER: explicit }, home), explicit);
    assert.equal(resolveRecorder({}, home), path.join(viaHome, "record-progress.py"));
    assert.equal(resolveRecorder({ KARPATHY_RECORDER: path.join(root, "missing.py") }, path.join(root, "nohome")), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("recorder absent: boundary_degraded logged, exit 0", () => {
  const { root, home } = sandbox();
  try {
    const { r, last } = run(root, isolatedEnv(home));
    assert.equal(r.status, 0);
    assert.equal(last.event, "boundary_degraded");
    assert.equal(last.outcome, "task:no-recorder");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("python absent: boundary_degraded logged, exit 0", () => {
  const { root, home } = sandbox();
  try {
    const recorder = path.join(root, "rec.py");
    writeFileSync(recorder, "print('{}')\n");
    const emptyBin = path.join(root, "empty-bin");
    mkdirSync(emptyBin);
    const { r, last } = run(root, isolatedEnv(home, { KARPATHY_RECORDER: recorder, PATH: emptyBin }), "change");
    assert.equal(r.status, 0);
    assert.equal(last.outcome, "change:no-python");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("recorder present: status recorded to the ledger", { skip: !hasPython && "python3 not installed" }, () => {
  const { root, home } = sandbox();
  try {
    const recorder = path.join(root, "rec.py");
    writeFileSync(recorder, [
      "import json, os, sys",
      "assert '--from-hook' in sys.argv and sys.argv[sys.argv.index('--boundary') + 1] == 'phase'",
      "print(json.dumps({'status': 'duplicate', 'hook': os.environ.get('KBD_HOOK_NAME', '')}))",
    ].join("\n"));
    const { r, last } = run(root, isolatedEnv(home, { KARPATHY_RECORDER: recorder, KBD_HOOK_NAME: "agent-dev-team" }), "phase");
    assert.equal(r.status, 0, r.stderr);
    assert.equal(last.event, "boundary_recorded");
    assert.equal(last.outcome, "phase:duplicate");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("recorder failure exit is logged as degraded, bridge still exits 0", { skip: !hasPython && "python3 not installed" }, () => {
  const { root, home } = sandbox();
  try {
    const recorder = path.join(root, "rec.py");
    writeFileSync(recorder, "import sys\nsys.exit(2)\n");
    const { r, last } = run(root, isolatedEnv(home, { KARPATHY_RECORDER: recorder }));
    assert.equal(r.status, 0);
    assert.equal(last.outcome, "task:recorder-exit-2");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid boundary argument degrades instead of failing", () => {
  const { root, home } = sandbox();
  try {
    const { r, last } = run(root, isolatedEnv(home), "sprint");
    assert.equal(r.status, 0);
    assert.equal(last.outcome, "bad-boundary-arg");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
