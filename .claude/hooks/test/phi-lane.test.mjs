import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bashUrls, candidateUrls, deniedUrl, isFhirShaped, isSandbox, isUploadCommand, parseSandboxes, serverUrls, tribeLaneActive, webFetchUrls } from "../dist/lib/phi-lane.mjs";

const hook = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "phi-lane-guard.mjs");

const ALLOWLIST = parseSandboxes(
  JSON.stringify({
    sandboxes: [{ host: "hapi.fhir.org", reason: "HAPI public test server" }],
  }),
);

test("isFhirShaped matches FHIR-ish paths and rejects ordinary ones", () => {
  assert.ok(isFhirShaped("https://example.com/fhir/Patient/1"));
  assert.ok(isFhirShaped("https://example.com/FHIR/Patient/1"));
  assert.ok(isFhirShaped("https://example.com/R4/Patient/1"));
  assert.ok(isFhirShaped("https://example.com/api/FHIR/R4/Patient/1"));
  assert.ok(!isFhirShaped("https://example.com/api/v1/users"));
  assert.ok(!isFhirShaped("not a url"));
});

test("isSandbox allows allowlisted hosts (and subdomains), this repo's own dev-server loopback port, denies other loopback ports and everything else", () => {
  assert.ok(isSandbox("https://hapi.fhir.org/baseR4/Patient/1", ALLOWLIST));
  assert.ok(isSandbox("https://sub.hapi.fhir.org/baseR4/Patient/1", ALLOWLIST));
  assert.ok(!isSandbox("https://production-ehr.example.com/fhir/Patient/1", ALLOWLIST));
  // A blanket "any loopback host is safe" rule is bypassable by port-forwarding or tunnelling a real
  // production endpoint onto localhost, so only this repo's own docker-compose dev-server port (9090)
  // is a sandbox by default — not every loopback port (e.g. 8080, adminer's port in the same compose file).
  assert.ok(isSandbox("http://localhost:9090/fhir/Patient", ALLOWLIST), "this repo's own dev FHIR server (docker-compose.yml)");
  assert.ok(isSandbox("http://127.0.0.1:9090/fhir/Patient", ALLOWLIST));
  assert.ok(!isSandbox("http://localhost:8080/fhir/Patient", ALLOWLIST), "not this repo's FHIR server port");
  assert.ok(!isSandbox("http://127.0.0.1/fhir/Patient", ALLOWLIST), "no port at all is not the known dev-server port");
});

test("isSandbox: a bracketed IPv6 loopback ([::1]) is recognized like other loopback forms", () => {
  assert.ok(isSandbox("http://[::1]:9090/fhir/Patient", ALLOWLIST));
  assert.ok(!isSandbox("http://[::1]:8080/fhir/Patient", ALLOWLIST));
});

test("isSandbox: PHI_LOCAL_SANDBOX=1 proves an operator-verified local endpoint on any loopback port", () => {
  assert.ok(isSandbox("http://localhost:8080/fhir/Patient", ALLOWLIST, { PHI_LOCAL_SANDBOX: "1" }));
  assert.ok(!isSandbox("http://localhost:8080/fhir/Patient", ALLOWLIST, { PHI_LOCAL_SANDBOX: "0" }));
  assert.ok(!isSandbox("https://production-ehr.example.com/fhir/Patient/1", ALLOWLIST, { PHI_LOCAL_SANDBOX: "1" }), "not a loophole for a non-loopback host");
});

test("isUploadCommand detects curl/wget/httpie write methods and bodies, and is false for a plain read", () => {
  assert.equal(isUploadCommand("Bash", { command: "curl https://hapi.fhir.org/baseR4/Patient/1" }), false);
  assert.equal(isUploadCommand("Bash", { command: "curl -d '{}' https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "curl --data-raw '{}' https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "curl -F file=@x.json https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "curl -T x.json https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "curl -X POST https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "curl --request PUT https://hapi.fhir.org/baseR4/Patient/1" }), true);
  assert.equal(isUploadCommand("Bash", { command: "wget --post-data='{}' https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "wget --post-file=x.json https://hapi.fhir.org/baseR4/Patient" }), true);
  assert.equal(isUploadCommand("Bash", { command: "http POST https://hapi.fhir.org/baseR4/Patient field=value" }), true);
  assert.equal(isUploadCommand("Edit", { command: "curl -d '{}' https://hapi.fhir.org/baseR4/Patient" }), false, "not a shell tool");
});

test("webFetchUrls only fires for fetch-like tool names with an http(s) url", () => {
  assert.deepEqual(webFetchUrls("WebFetch", { url: "https://x.example.com/fhir/Patient" }), ["https://x.example.com/fhir/Patient"]);
  assert.deepEqual(webFetchUrls("Edit", { url: "https://x.example.com/fhir/Patient" }), []);
  assert.deepEqual(webFetchUrls("WebFetch", { url: "not-a-url" }), []);
});

test("serverUrls extracts an MCP-shaped base_url/server field regardless of tool name", () => {
  assert.deepEqual(serverUrls({ base_url: "https://ehr.example.com/fhir" }), ["https://ehr.example.com/fhir"]);
  assert.deepEqual(serverUrls({ server: "https://ehr.example.com/fhir" }), ["https://ehr.example.com/fhir"]);
  assert.deepEqual(serverUrls({ file_path: "x.go" }), []);
});

test("bashUrls only fires for shell-like tools with a fetch hint in the command", () => {
  assert.deepEqual(bashUrls("Bash", { command: "curl https://ehr.example.com/fhir/Patient/1" }), ["https://ehr.example.com/fhir/Patient/1"]);
  assert.deepEqual(bashUrls("Bash", { command: "ls -la" }), []);
  assert.deepEqual(bashUrls("Edit", { command: "curl https://ehr.example.com/fhir/Patient/1" }), []);
});

// Regression fixture for the actual Codex `exec_command` tool shape: the
// installed Codex CLI (0.154.0) reports its shell-call parameters as a
// `command` field (confirmed via `strings` on the compiled binary: the
// serialized `CommandExecParams` struct's field name, and the hook-input
// validation error "hook returned updatedInput without string field
// `command`"), not `cmd`. This is already covered by COMMAND_FIELDS; the
// fixture exists so a future Codex payload-shape change is caught here.
test("bashUrls covers the actual Codex exec_command tool shape (tool name exec_command, field command)", () => {
  assert.deepEqual(bashUrls("exec_command", { command: "curl https://ehr.example.com/fhir/Patient/1" }), ["https://ehr.example.com/fhir/Patient/1"]);
});

test("candidateUrls merges every detection surface", () => {
  assert.deepEqual(candidateUrls("WebFetch", { url: "https://a.example.com/fhir/Patient" }), ["https://a.example.com/fhir/Patient"]);
  assert.deepEqual(candidateUrls("mcp__ehr__pull", { base_url: "https://b.example.com/fhir" }), ["https://b.example.com/fhir"]);
});

test("tribeLaneActive requires PHI_LANE=tribe and a matching active endpoint, not just a declared one", () => {
  assert.equal(tribeLaneActive({}), false);
  assert.equal(tribeLaneActive({ PHI_LANE: "tribe" }), false, "declared lane without an endpoint is still synthetic");
  assert.equal(tribeLaneActive({ PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1" }), false, "no proof the active endpoint matches");
  assert.equal(
    tribeLaneActive({ PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://elsewhere.example.com" }),
    false,
    "mismatched endpoint",
  );
  assert.equal(
    tribeLaneActive({ PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://tribe.local/v1" }),
    true,
  );
});

test("deniedUrl: production denied without a lane, denied with a mismatched lane, allowed with a proven lane, sandboxes allowed, non-FHIR allowed", () => {
  const prod = { url: "https://ehr.example.com/fhir/Patient/1" };
  assert.equal(deniedUrl("WebFetch", prod, ALLOWLIST, {}), "https://ehr.example.com/fhir/Patient/1");
  assert.equal(
    deniedUrl("WebFetch", prod, ALLOWLIST, { PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://other.example.com" }),
    "https://ehr.example.com/fhir/Patient/1",
  );
  assert.equal(
    deniedUrl("WebFetch", prod, ALLOWLIST, { PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://tribe.local/v1" }),
    undefined,
  );
  assert.equal(deniedUrl("WebFetch", { url: "https://hapi.fhir.org/baseR4/Patient/1" }, ALLOWLIST, {}), undefined, "sandbox is always allowed");
  assert.equal(deniedUrl("WebFetch", { url: "https://ehr.example.com/api/v1/patients" }, ALLOWLIST, {}), undefined, "non-FHIR-shaped URL is allowed");
});

test("deniedUrl: an upload to an allowlisted sandbox is denied without a proven Tribe lane (this guard can't tell synthetic data from real), a plain read to the same sandbox is allowed", () => {
  const upload = { command: "curl -d '{\"resourceType\":\"Patient\"}' https://hapi.fhir.org/fhir/Patient" };
  assert.equal(deniedUrl("Bash", upload, ALLOWLIST, {}), "https://hapi.fhir.org/fhir/Patient");
  assert.equal(
    deniedUrl("Bash", upload, ALLOWLIST, { PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://tribe.local/v1" }),
    undefined,
    "a proven Tribe lane still allows it",
  );
  const read = { command: "curl https://hapi.fhir.org/fhir/Patient/1" };
  assert.equal(deniedUrl("Bash", read, ALLOWLIST, {}), undefined, "a plain read to the same sandbox is unaffected");
});

function sandboxRepo() {
  const root = mkdtempSync(path.join(tmpdir(), "phi-lane-guard-"));
  mkdirSync(path.join(root, ".claude", "hooks"), { recursive: true });
  writeFileSync(path.join(root, ".claude", "hooks", "phi-sandboxes.json"), JSON.stringify({ sandboxes: [{ host: "hapi.fhir.org", reason: "HAPI public test server" }] }));
  return root;
}

function run(root, payload, env = {}) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", ...payload }),
    encoding: "utf8",
    env: { ...process.env, ...env, CLAUDE_PROJECT_DIR: root },
  });
  return { status: r.status, body: r.stdout === "" ? null : JSON.parse(r.stdout) };
}

test("hook: a production FHIR pull is denied without a lane", () => {
  const root = sandboxRepo();
  try {
    const { status, body } = run(root, { tool_name: "WebFetch", tool_input: { url: "https://ehr.example.com/fhir/Patient/1" } });
    assert.equal(status, 0);
    assert.equal(body?.hookSpecificOutput?.permissionDecision, "deny");
    assert.match(body.hookSpecificOutput.permissionDecisionReason, /ATH-D-001/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: denied when PHI_LANE=tribe is declared but the active endpoint does not match", () => {
  const root = sandboxRepo();
  try {
    const { body } = run(
      root,
      { tool_name: "WebFetch", tool_input: { url: "https://ehr.example.com/fhir/Patient/1" } },
      { PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://cloud.example.com" },
    );
    assert.equal(body?.hookSpecificOutput?.permissionDecision, "deny");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: allowed with a proven Tribe lane", () => {
  const root = sandboxRepo();
  try {
    const { body } = run(
      root,
      { tool_name: "WebFetch", tool_input: { url: "https://ehr.example.com/fhir/Patient/1" } },
      { PHI_LANE: "tribe", TRIBE_MODEL_BASE_URL: "https://tribe.local/v1", AGENT_MODEL_BASE_URL: "https://tribe.local/v1" },
    );
    assert.equal(body, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: sandbox and non-FHIR URLs are allowed without any lane", () => {
  const root = sandboxRepo();
  try {
    assert.equal(run(root, { tool_name: "WebFetch", tool_input: { url: "https://hapi.fhir.org/baseR4/Patient/1" } }).body, null);
    assert.equal(run(root, { tool_name: "WebFetch", tool_input: { url: "https://example.com/api/v1/widgets" } }).body, null);
    assert.equal(run(root, { tool_name: "Bash", tool_input: { command: "ls -la" } }).body, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("hook: malformed input and a missing allowlist never block", () => {
  const root = mkdtempSync(path.join(tmpdir(), "phi-lane-guard-noallow-"));
  try {
    const r = spawnSync(process.execPath, [hook], { input: "not json", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /malformed/);
    // No phi-sandboxes.json in this repo: the guard must still evaluate (fail open on config, fail closed on lane proof).
    const { body } = run(root, { tool_name: "WebFetch", tool_input: { url: "https://ehr.example.com/fhir/Patient/1" } });
    assert.equal(body?.hookSpecificOutput?.permissionDecision, "deny");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
