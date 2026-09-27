#!/usr/bin/env node
// Mirror the team's domain skills from .agents/skills/ (the source) into each
// harness skill directory. Only skills listed in .agents/skills/SOURCES.json
// ("project" and "thirdParty") are mirrored; other skills in a target
// (openspec-*, karpathy-guidelines) are left alone. Each target records what
// it received in MARKER, so a skill later dropped from SOURCES.json is removed
// (or, with --check, reported) instead of lingering as a committed orphan.
//
//   node scripts/agent-team/mirror-skills.mjs          # write mirrors
//   node scripts/agent-team/mirror-skills.mjs --check  # exit 1 on drift
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = path.join(repoRoot, ".agents", "skills");
export const TARGETS = [".claude/skills", ".opencode/skills", ".kimi-code/skills", ".minimax/skills"];
export const MARKER = ".team-skills.json";

/** Skills a target received on its last mirror run, per its marker file. */
function previouslyMirrored(targetDir) {
  const f = path.join(targetDir, MARKER);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).skills : [];
}

function markerText(skills) {
  return `${JSON.stringify({ generatedBy: "scripts/agent-team/mirror-skills.mjs", skills }, null, 2)}\n`;
}

export function mirroredSkills() {
  const sources = JSON.parse(readFileSync(path.join(source, "SOURCES.json"), "utf8"));
  return [...sources.project, ...Object.keys(sources.thirdParty)].sort();
}

/** Relative file paths under dir, "/"-separated and sorted, so output is stable on every OS. */
function listFiles(dir, prefix = "") {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === "" ? e.name : `${prefix}/${e.name}`;
    if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out.sort();
}

/** Describe how target differs from src, or return undefined when identical. */
export function diffTree(src, target) {
  if (!existsSync(target) || !statSync(target).isDirectory()) return "missing";
  const a = listFiles(src);
  const b = listFiles(target);
  if (a.join("\n") !== b.join("\n")) return "file list differs";
  for (const f of a) {
    if (!readFileSync(path.join(src, f)).equals(readFileSync(path.join(target, f)))) return `content differs: ${f}`;
  }
  return undefined;
}

/** Classification problems: a skill listed in more than one SOURCES.json category, or a source skill in none. */
export function classificationProblems() {
  const sources = JSON.parse(readFileSync(path.join(source, "SOURCES.json"), "utf8"));
  const categories = { project: sources.project, thirdParty: Object.keys(sources.thirdParty), generated: sources.generated };
  const seen = new Map();
  for (const [category, names] of Object.entries(categories)) {
    for (const name of names) seen.set(name, [...(seen.get(name) ?? []), category]);
  }
  const problems = [];
  for (const [name, cats] of seen) if (cats.length > 1) problems.push(`${name} is listed in ${cats.join(" and ")}`);
  for (const e of readdirSync(source, { withFileTypes: true })) {
    if (e.isDirectory() && existsSync(path.join(source, e.name, "SKILL.md")) && !seen.has(e.name)) problems.push(`${e.name} is not classified`);
  }
  return problems.sort();
}

function main() {
  const check = process.argv.includes("--check");
  let drift = 0;
  // Generated skills (openspec init) are written per harness by their
  // generator, so they are listed but never mirrored. Anything unlisted fails.
  const problems = classificationProblems();
  if (problems.length > 0) {
    for (const p of problems) console.error(`mirror-skills: .agents/skills/SOURCES.json: ${p} (each skill needs exactly one of project, thirdParty, generated)`);
    process.exit(1);
  }
  for (const skill of mirroredSkills()) {
    const src = path.join(source, skill);
    if (!existsSync(path.join(src, "SKILL.md"))) {
      console.error(`mirror-skills: ${skill} is listed in SOURCES.json but .agents/skills/${skill}/SKILL.md is missing`);
      process.exit(1);
    }
    for (const t of TARGETS) {
      const target = path.join(repoRoot, t, skill);
      const why = diffTree(src, target);
      if (why === undefined) continue;
      if (check) {
        console.error(`mirror-skills: ${t}/${skill}: ${why}`);
        drift++;
        continue;
      }
      rmSync(target, { recursive: true, force: true });
      cpSync(src, target, { recursive: true });
      console.log(`mirror-skills: updated ${t}/${skill} (${why})`);
    }
  }
  const skills = mirroredSkills();
  for (const t of TARGETS) {
    const targetDir = path.join(repoRoot, t);
    for (const stale of previouslyMirrored(targetDir).filter((s) => !skills.includes(s))) {
      if (!existsSync(path.join(targetDir, stale))) continue;
      if (check) {
        console.error(`mirror-skills: ${t}/${stale}: no longer in SOURCES.json`);
        drift++;
        continue;
      }
      rmSync(path.join(targetDir, stale), { recursive: true, force: true });
      console.log(`mirror-skills: removed stale ${t}/${stale}`);
    }
    const marker = path.join(targetDir, MARKER);
    const want = markerText(skills);
    // Compare without CR so a CRLF checkout (Windows, text=auto) is not drift.
    if (existsSync(marker) && readFileSync(marker, "utf8").replace(/\r\n/g, "\n") === want) continue;
    if (check) {
      console.error(`mirror-skills: ${t}/${MARKER}: out of date`);
      drift++;
      continue;
    }
    writeFileSync(marker, want);
  }
  if (check && drift > 0) {
    console.error(`mirror-skills: ${drift} mirror(s) out of date; run node scripts/agent-team/mirror-skills.mjs`);
    process.exit(1);
  }
  console.log(`mirror-skills: ${check ? "in sync" : "done"} (${mirroredSkills().length} skills x ${TARGETS.length} targets)`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
