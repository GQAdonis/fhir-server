// Checks run after an agent edits a Go file. Both return feedback text for
// the agent (or undefined) and never block: PostToolUse cannot undo a write,
// so the useful outcome is a precise instruction for the next step.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { targetPath } from "./protected-paths.mjs";

export const GOFMT_TIMEOUT_MS = 10_000;
const HEADER_WINDOW_LINES = 30;

/** Absolute path of the edited `.go` file, if the tool call edited one. */
export function goTarget(toolInput: unknown, projectRoot: string): string | undefined {
  const target = targetPath(toolInput);
  if (target === undefined || !target.endsWith(".go")) return undefined;
  const full = path.isAbsolute(target) ? target : path.join(projectRoot, target);
  return existsSync(full) ? full : undefined;
}

/**
 * True when the leading `//` comment block (before `package`) carries the
 * project header: a WSO2 LLC copyright line and the Apache License, Version 2.0
 * grant. A stray mention of "Apache License" elsewhere does not count.
 */
export function hasLicenseHeader(source: string): boolean {
  const comments: string[] = [];
  for (const line of source.split(/\r?\n/, HEADER_WINDOW_LINES)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("package ")) break;
    if (trimmed.startsWith("//")) comments.push(trimmed);
    else if (trimmed.startsWith("//go:build")) continue;
  }
  const block = comments.join("\n");
  return /Copyright \(c\) \d{4}, WSO2 LLC/.test(block) && /Apache License/.test(block) && /Version 2\.0/.test(block);
}

export function licenseFeedback(file: string, displayPath: string): string | undefined {
  if (hasLicenseHeader(readFileSync(file, "utf8"))) return undefined;
  return [
    `${displayPath} is missing the Apache 2.0 license header required on every .go file (CLAUDE.md, constraint license-header).`,
    "Copy the 15-line `// Copyright (c) <year>, WSO2 LLC. …` header from any existing source file (e.g. internal/config/config.go) to the top of this file.",
  ].join(" ");
}

export type GofmtOutcome =
  | { readonly kind: "clean" }
  | { readonly kind: "unformatted" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "error"; readonly detail: string };

export function runGofmt(file: string, env: NodeJS.ProcessEnv = process.env): GofmtOutcome {
  const r = spawnSync("gofmt", ["-l", file], { encoding: "utf8", timeout: GOFMT_TIMEOUT_MS, windowsHide: true, env });
  if (r.error !== undefined) {
    const code = (r.error as NodeJS.ErrnoException).code;
    return code === "ENOENT" ? { kind: "unavailable" } : { kind: "error", detail: code === "ETIMEDOUT" ? "timed out" : String(code) };
  }
  if (r.status !== 0) return { kind: "error", detail: r.stderr.trim().split("\n")[0] ?? `exit ${r.status}` };
  return r.stdout.trim() === "" ? { kind: "clean" } : { kind: "unformatted" };
}
