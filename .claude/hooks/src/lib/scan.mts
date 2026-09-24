// PHI / secret scanner for content that will be committed under .prometheus/.
//
// Reports pattern ids and positions only — never the matched text — so a scan
// report can itself be logged or shown without leaking what it found.

export interface ScanRule {
  readonly id: string;
  readonly pattern: RegExp;
}

export interface ScanMatch {
  readonly rule: string;
  readonly line: number;
  readonly column: number;
}

export interface Allowlist {
  /**
   * Known-synthetic values (e.g. `noreply@anthropic.com`). A match is allowed
   * only when it equals an entry exactly; entries shorter than 8 characters are
   * ignored so a broad entry like `.com` or `@` cannot switch the scanner off.
   */
  readonly literals?: readonly string[];
}

export const MIN_ALLOWLIST_LENGTH = 8;

export const RULES: readonly ScanRule[] = [
  { id: "us-ssn", pattern: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { id: "mrn", pattern: /\bMRN\s*[:#=]?\s*[A-Z0-9][A-Z0-9-]{4,}\b/gi },
  { id: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
  { id: "phone", pattern: /(?<![\w-])(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![\w-])/g },
  { id: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
  { id: "sk-key", pattern: /\bsk-[A-Za-z0-9_-]{16,}/g },
  { id: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: "credentialed-dsn", pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@/gi },
];

function allowed(matched: string, allowlist: Allowlist): boolean {
  return (allowlist.literals ?? []).some((literal) => literal.length >= MIN_ALLOWLIST_LENGTH && matched === literal);
}

/** Scan text and return every match position (never the matched text). */
export function scanText(text: string, allowlist: Allowlist = {}): ScanMatch[] {
  const matches: ScanMatch[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      for (const m of line.matchAll(rule.pattern)) {
        if (allowed(m[0], allowlist)) continue;
        matches.push({ rule: rule.id, line: index + 1, column: (m.index ?? 0) + 1 });
      }
    }
  });
  return matches;
}

const SYNTHETIC_EMAIL = /@(?:[A-Za-z0-9-]+\.)*(?:example\.(?:com|org|net)|example|invalid|test|localhost)$|^noreply@anthropic\.com$/i;

/**
 * Split allowlist entries into usable and rejected ones. The allowlist must not
 * become a way to commit real data, so an entry is accepted only if it is at
 * least MIN_ALLOWLIST_LENGTH characters and every rule it matches is an email on
 * a reserved/synthetic domain (RFC 2606/6761: example.*, .invalid, .test,
 * .localhost) or the fixed `noreply@anthropic.com` commit trailer. Entries that
 * match any other rule (SSN, keys, DSNs, phones, real emails) are rejected.
 */
export function validateAllowlist(allowlist: Allowlist): { accepted: Allowlist; rejected: number } {
  const accepted: string[] = [];
  let rejected = 0;
  for (const literal of allowlist.literals ?? []) {
    const hits = scanText(literal);
    const synthetic =
      literal.length >= MIN_ALLOWLIST_LENGTH &&
      hits.length > 0 &&
      hits.every((h) => h.rule === "email") &&
      SYNTHETIC_EMAIL.test(literal);
    if (synthetic) accepted.push(literal);
    else rejected += 1;
  }
  return { accepted: { literals: accepted }, rejected };
}

/** Parse `.prometheus/scan-allowlist.json` content; invalid content means no allowlist. */
export function parseAllowlist(raw: string | undefined): Allowlist {
  if (raw === undefined) return {};
  try {
    const value = JSON.parse(raw) as { literals?: unknown };
    const literals = Array.isArray(value.literals)
      ? value.literals.filter((x): x is string => typeof x === "string")
      : [];
    return { literals };
  } catch {
    return {};
  }
}
