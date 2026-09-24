import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { scanText, parseAllowlist, validateAllowlist } from "../dist/lib/scan.mjs";

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "scan-prometheus.mjs");

const SEEDED = {
  "us-ssn": "patient ssn 123-45-6789 on file",
  mrn: "chart MRN: A12345-77",
  email: "contact jane.doe@example-hospital.org",
  phone: "call (555) 123-4567 tomorrow",
  "bearer-token": "Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123",
  "sk-key": "key sk-proj_ABCDEFGHIJKLMNOPQR",
  "aws-access-key": "AKIAABCDEFGHIJKLMNOP",
  "private-key": "-----BEGIN RSA PRIVATE KEY-----",
  "credentialed-dsn": "postgres://fhir:s3cret@db:5432/fhir",
};

for (const [rule, text] of Object.entries(SEEDED)) {
  test(`flags seeded ${rule}`, () => {
    const hits = scanText(text);
    assert.ok(hits.some((h) => h.rule === rule), `${rule} not flagged in ${JSON.stringify(hits)}`);
  });
}

test("clean KBD-style content passes", () => {
  const text = [
    "- Event: `kpm-8983e83069ea95f60cea10d61518eca8`",
    "- Position: `agent-dev-team` / `add-hooks-typescript-toolchain` / `1`",
    "- Commit: `576818cd3433e18a79a4374b50fe68c49522d908`",
    "2026-09-24T12:11:06.881754Z go test -race -tags integration ./internal/store/...",
    "postgres://localhost/fhir and DSN without credentials",
    "version 1.25.3, port 9090, id 000-00-0000",
  ].join("\n");
  assert.deepEqual(scanText(text), []);
});

test("matches report position, not content", () => {
  const [hit] = scanText("line one\nssn 123-45-6789");
  assert.deepEqual(hit, { rule: "us-ssn", line: 2, column: 5 });
  assert.ok(!JSON.stringify(hit).includes("6789"));
});

test("allowlist literals suppress known-synthetic values", () => {
  const allow = parseAllowlist(JSON.stringify({ literals: ["noreply@anthropic.com"] }));
  assert.deepEqual(scanText("Co-Authored-By: Claude <noreply@anthropic.com>", allow), []);
  assert.equal(scanText("x@evil.com", allow).length, 1);
  const broad = parseAllowlist(JSON.stringify({ literals: [".com", "@", "evil.com"] }));
  assert.equal(scanText("ops@evil.com", broad).length, 1, "broad or partial entries never suppress");
  assert.deepEqual(parseAllowlist("{bad"), {});
});

test("CLI exits 0 on a clean tree and 1 with file:line without echoing matches", () => {
  const root = mkdtempSync(path.join(tmpdir(), "scan-"));
  try {
    mkdirSync(path.join(root, "raw"));
    writeFileSync(path.join(root, "raw", "ok.md"), "clean note\n");
    const clean = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /clean \(1 file/);

    writeFileSync(path.join(root, "raw", "bad.md"), "intro\nSSN 123-45-6789\n");
    const dirty = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /raw\/bad\.md:2:5: us-ssn/);
    assert.ok(!dirty.stderr.includes("123-45-6789"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validateAllowlist accepts only synthetic emails", () => {
  const { accepted, rejected } = validateAllowlist({
    literals: ["noreply@anthropic.com", "fixture.patient@example.org", "dev@hospital.org", "123-45-6789", "sk-proj_ABCDEFGHIJKLMNOPQR", "postgres://u:p@db/x", "just-text-no-match"],
  });
  assert.deepEqual(accepted.literals, ["noreply@anthropic.com", "fixture.patient@example.org"]);
  assert.equal(rejected, 5);
});

test("CLI flags a non-synthetic allowlist entry and does not apply it", () => {
  const root = mkdtempSync(path.join(tmpdir(), "scan-"));
  try {
    writeFileSync(path.join(root, "scan-allowlist.json"), JSON.stringify({ literals: ["jane@hospital.org"] }));
    writeFileSync(path.join(root, "note.md"), "contact jane@hospital.org\n");
    const r = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /1 entry is not synthetic/);
    assert.match(r.stderr, /note\.md:1:9: email/, "rejected entry does not suppress the match");
    assert.ok(!r.stderr.includes("jane@hospital.org"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI reports the allowlist size but never its values", () => {
  const root = mkdtempSync(path.join(tmpdir(), "scan-"));
  try {
    writeFileSync(path.join(root, "scan-allowlist.json"), JSON.stringify({ literals: ["noreply@anthropic.com"] }));
    writeFileSync(path.join(root, "note.md"), "Co-Authored-By: Claude <noreply@anthropic.com>\n");
    const r = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 allowlisted literal\(s\)/);
    assert.ok(!`${r.stdout}${r.stderr}`.includes("noreply@anthropic.com"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI counts binary files as findings (fail closed)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "scan-"));
  try {
    writeFileSync(path.join(root, "blob.bin"), Buffer.from([0x68, 0x00, 0x69]));
    const r = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /blob\.bin: binary content not scanned/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("inside a git work tree only committable files are scanned; --all scans ignored files too", { skip: spawnSync("git", ["--version"]).status !== 0 && "git not installed" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "scan-git-"));
  try {
    spawnSync("git", ["init", "-q"], { cwd: root });
    writeFileSync(path.join(root, ".gitignore"), "local-*.md\n");
    writeFileSync(path.join(root, "local-reply.md"), "SSN 123-45-6789\n");
    writeFileSync(path.join(root, "note.md"), "clean\n");
    const scoped = spawnSync(process.execPath, [cli, root], { encoding: "utf8" });
    assert.equal(scoped.status, 0, scoped.stderr);
    assert.match(scoped.stdout, /scope = committable files/);
    const all = spawnSync(process.execPath, [cli, root, "--all"], { encoding: "utf8" });
    assert.equal(all.status, 1);
    assert.match(all.stderr, /local-reply\.md:1:5: us-ssn/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("CLI treats a missing directory as nothing to scan", () => {
  const r = spawnSync(process.execPath, [cli, path.join(tmpdir(), "does-not-exist-xyz")], { encoding: "utf8" });
  assert.equal(r.status, 0);
});
