// PHI-lane detection (change `configure-phi-lanes`).
//
// Defense in depth for ATH-D-001: Tribe Health Solutions' local models are the
// only BAA-covered provider. A FHIR pull to a non-sandbox endpoint must run on
// a *proven* Tribe lane, never a session that merely claims one. Policy (the
// `phi-lane-policy` skill) is primary; this module is a backstop and can be
// evaded by an obfuscated shell command (documented residual risk,
// docs/agent-team.md).

/** A FHIR-shaped path segment: `/fhir`, `/FHIR`, `/R4`, `/api/FHIR`, case-insensitive. */
const FHIR_PATH = /(^|\/)(fhir|r4|api\/fhir)(\/|$|\?|#)/i;

/** Bash commands are scanned for URLs only when they look like a fetch of something FHIR-related. */
const FETCH_HINT = /\b(curl|wget|httpie|fhir)\b/i;

/** A "fetch-like" tool name, across harnesses (`WebFetch`, `webfetch`, `web_fetch`, …). */
const FETCH_TOOL = /fetch/i;

/** A "shell-like" tool name, across harnesses (`Bash`, `shell`, `exec_command`, `sh`). */
const SHELL_TOOL = /^(bash|shell|exec_command|sh)$/i;

const URL_PATTERN = /https?:\/\/[^\s"'`)>]+/g;

/** Field names an MCP-style tool input uses for its target server. */
const SERVER_FIELDS = ["base_url", "baseUrl", "server", "serverUrl"] as const;

/** Field names a shell-like tool input uses for the command text. */
const COMMAND_FIELDS = ["command", "script"] as const;

export interface SandboxEntry {
  readonly host: string;
  readonly reason: string;
}

export interface Allowlist {
  readonly sandboxes: readonly SandboxEntry[];
}

/** Parse `phi-sandboxes.json` content. Malformed or missing content yields no sandboxes (fail closed: an unreadable allowlist protects nothing extra, it never allows more). */
export function parseSandboxes(raw: string | undefined): Allowlist {
  if (raw === undefined) return { sandboxes: [] };
  try {
    const value = JSON.parse(raw) as { sandboxes?: unknown };
    const sandboxes = Array.isArray(value.sandboxes)
      ? value.sandboxes.filter(
          (s): s is SandboxEntry =>
            s !== null && typeof s === "object" && typeof (s as Record<string, unknown>)["host"] === "string" && typeof (s as Record<string, unknown>)["reason"] === "string",
        )
      : [];
    return { sandboxes };
  } catch {
    return { sandboxes: [] };
  }
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** True for loopback hosts and any host on the allowlist (exact match or a subdomain of one). */
export function isSandbox(url: string, allowlist: Allowlist): boolean {
  const host = hostOf(url);
  if (host === undefined) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  return allowlist.sandboxes.some((s) => host === s.host.toLowerCase() || host.endsWith(`.${s.host.toLowerCase()}`));
}

/** True when the URL's path looks like a FHIR REST endpoint. */
export function isFhirShaped(url: string): boolean {
  try {
    return FHIR_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function fieldValue(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

/** URLs a WebFetch-shaped tool call would reach. */
export function webFetchUrls(toolName: string, toolInput: unknown): string[] {
  if (!FETCH_TOOL.test(toolName)) return [];
  if (toolInput === null || typeof toolInput !== "object") return [];
  const url = (toolInput as Record<string, unknown>)["url"];
  return typeof url === "string" && /^https?:\/\//i.test(url) ? [url] : [];
}

/**
 * URLs any tool call declares as its target server, from an MCP-shaped
 * `base_url`/`server` field. Not gated on tool name: MCP tool-naming
 * conventions differ per harness, but a `base_url`/`server` field is not
 * something an ordinary Edit/Write/Bash input carries by accident.
 */
export function serverUrls(toolInput: unknown): string[] {
  if (toolInput === null || typeof toolInput !== "object") return [];
  const v = fieldValue(toolInput as Record<string, unknown>, SERVER_FIELDS);
  return v !== undefined && /^https?:\/\//i.test(v) ? [v] : [];
}

/** URLs in a shell command, only when the command looks like a fetch of something FHIR-related. */
export function bashUrls(toolName: string, toolInput: unknown): string[] {
  if (!SHELL_TOOL.test(toolName)) return [];
  if (toolInput === null || typeof toolInput !== "object") return [];
  const command = fieldValue(toolInput as Record<string, unknown>, COMMAND_FIELDS);
  if (command === undefined || !FETCH_HINT.test(command)) return [];
  return [...command.matchAll(URL_PATTERN)].map((m) => m[0]);
}

/** Every candidate URL a tool call would reach, across the detection surfaces this guard covers. */
export function candidateUrls(toolName: string, toolInput: unknown): string[] {
  return [...webFetchUrls(toolName, toolInput), ...serverUrls(toolInput), ...bashUrls(toolName, toolInput)];
}

/**
 * True only when the session has both declared and proven the Tribe lane:
 * `PHI_LANE=tribe`, `TRIBE_MODEL_BASE_URL` set, and `AGENT_MODEL_BASE_URL`
 * (the harness's actual active model endpoint, exported by the operator at
 * launch — never something a tool call can set for the running session)
 * equal to it. Declaring the lane without a matching endpoint is still the
 * synthetic lane (`phi-lane-policy`).
 */
export function tribeLaneActive(env: Readonly<Record<string, string | undefined>>): boolean {
  if (env["PHI_LANE"] !== "tribe") return false;
  const tribeUrl = env["TRIBE_MODEL_BASE_URL"];
  const active = env["AGENT_MODEL_BASE_URL"];
  return typeof tribeUrl === "string" && tribeUrl !== "" && active === tribeUrl;
}

/**
 * The FHIR-shaped, non-sandbox URL a tool call would reach without a proven
 * Tribe lane, or undefined when the call is fine (sandbox, non-FHIR, or a
 * proven Tribe lane).
 */
export function deniedUrl(toolName: string, toolInput: unknown, allowlist: Allowlist, env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (tribeLaneActive(env)) return undefined;
  return candidateUrls(toolName, toolInput).find((url) => isFhirShaped(url) && !isSandbox(url, allowlist));
}
