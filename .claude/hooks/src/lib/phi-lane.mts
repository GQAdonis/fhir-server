// PHI-lane detection (change `configure-phi-lanes`).
//
// Defense in depth for ATH-D-001: Tribe Health Solutions' local models are the
// only BAA-covered provider. A FHIR pull to a non-sandbox endpoint must run on
// a *proven* Tribe lane, never a session that merely claims one. Policy (the
// `phi-lane-policy` skill) is primary; this module is a backstop and can be
// evaded by an obfuscated shell command (documented residual risk,
// docs/agent-team.md).

/**
 * A FHIR-shaped path segment: `/fhir`, `/FHIR`, `/R4`, `/api/FHIR`,
 * case-insensitive. Matched only against `URL.pathname`, which never
 * contains `?` or `#` (those are `search`/`hash`), so the terminator
 * alternation is just `/` or end-of-string.
 */
const FHIR_PATH = /(^|\/)(fhir|r4|api\/fhir)(\/|$)/i;

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

/**
 * Flags/methods that mean a shell fetch command sends a body (an upload),
 * across curl, wget and httpie. Detecting these matters because a public FHIR
 * sandbox is safe to *read* from, but this guard cannot tell synthetic test
 * data from real PHI in an upload body — so an upload is treated like a
 * non-sandbox destination unless the lane is proven, even to an allowlisted
 * sandbox host.
 */
const UPLOAD_PATTERNS: readonly RegExp[] = [
  /(^|\s)-d(\s|=|$)/, // curl -d
  /--data(-raw|-binary|-urlencode)?(\s|=)/, // curl --data*
  /(^|\s)-F(\s|=)/, // curl -F
  /--form(\s|=)/, // curl --form
  /(^|\s)-T(\s|=)/, // curl -T
  /--upload-file(\s|=)/, // curl --upload-file
  /--post-file(\d)?(\s|=)/, // wget --post-file
  /--post-data(\s|=)/, // wget --post-data
  /(-X|--request)\s*=?\s*"?(POST|PUT|PATCH|DELETE)"?\b/i, // curl method override
  /\bhttps?\s+(POST|PUT|PATCH|DELETE)\b/i, // httpie: http POST url ...
];

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

/** `hostname` for a bracketed IPv6 literal keeps its brackets (`"[::1]"`); strip them so `"::1"` compares equal. */
function stripBrackets(host: string): string {
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

/** The URL's hostname, lower-cased and with IPv6 brackets stripped, or undefined for an unparseable URL. */
export function hostOf(url: string): string | undefined {
  try {
    return stripBrackets(new URL(url).hostname.toLowerCase());
  } catch {
    return undefined;
  }
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * This repo's own dev-server loopback port (docker-compose.yml `fhir-server`
 * service), treated as a sandbox by default without an allowlist entry or
 * operator opt-in.
 */
const LOCAL_DEV_SERVER_PORT = "9090";

/**
 * True for an allowlisted host (exact match or a subdomain of one), for this
 * repo's own loopback dev-server port, or for any loopback host when the
 * operator has set `PHI_LOCAL_SANDBOX=1` to vouch for a locally-verified
 * endpoint. A blanket "every loopback host is a sandbox" rule is bypassable
 * by port-forwarding or tunnelling a real production endpoint onto
 * localhost, so loopback alone is no longer sufficient.
 */
export function isSandbox(url: string, allowlist: Allowlist, env: Readonly<Record<string, string | undefined>> = {}): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = stripBrackets(parsed.hostname.toLowerCase());
  if (allowlist.sandboxes.some((s) => host === s.host.toLowerCase() || host.endsWith(`.${s.host.toLowerCase()}`))) return true;
  if (!isLoopbackHost(host)) return false;
  if (parsed.port === LOCAL_DEV_SERVER_PORT) return true;
  return env["PHI_LOCAL_SANDBOX"] === "1";
}

/** True when a shell-like tool call's command sends a body (an upload), across curl/wget/httpie. */
export function isUploadCommand(toolName: string, toolInput: unknown): boolean {
  if (!SHELL_TOOL.test(toolName)) return false;
  if (toolInput === null || typeof toolInput !== "object") return false;
  const command = fieldValue(toolInput as Record<string, unknown>, COMMAND_FIELDS);
  if (command === undefined) return false;
  return UPLOAD_PATTERNS.some((p) => p.test(command));
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
 * The FHIR-shaped URL a tool call would reach without a proven Tribe lane,
 * when that call is either a non-sandbox destination or an upload (even to a
 * sandbox — this guard cannot tell synthetic data from real in a body), or
 * undefined when the call is fine (a non-uploading sandbox read, a
 * non-FHIR-shaped URL, or a proven Tribe lane).
 */
export function deniedUrl(toolName: string, toolInput: unknown, allowlist: Allowlist, env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (tribeLaneActive(env)) return undefined;
  const uploading = isUploadCommand(toolName, toolInput);
  return candidateUrls(toolName, toolInput).find((url) => isFhirShaped(url) && (uploading || !isSandbox(url, allowlist, env)));
}
