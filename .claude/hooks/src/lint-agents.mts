// CLI: lint the agent team.
//   node .claude/hooks/dist/lint-agents.mjs [<repo-root>] [--skip-drift]
// Checks .claude/agents/*.md against docs/agent-team.md. When the repository
// has a team manifest (.agent-team/team.json) it also checks every harness's
// generated definitions (roster, structure, PHI-lane block, Harness card) and
// re-runs the team scripts in check mode to catch drift. Drift needs
// agent-team-creator ($AGENT_TEAM_CREATOR). --skip-drift is for offline runs:
// the structural checks still run, but the command exits 3 ("drift not
// verified") instead of 0, so a skipped drift check can never pass as clean.
// Exits 1 listing every problem; 0 with a one-line summary when fully clean.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lintAll } from "./lib/agent-lint.mjs";
import { driftProblems, lintHarnesses, minimaxCommittableProblems, rosterIds } from "./lib/harness-lint.mjs";

// npm runs scripts from .claude/hooks/, so default to the repository that
// contains this script (dist/ -> hooks/ -> .claude/ -> repo).
const args = process.argv.slice(2);
const repoRoot = args.find((a) => !a.startsWith("--")) ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const home = os.homedir();
const { agents, problems } = lintAll({
  repoRoot,
  localSkillDirs: [path.join(home, ".claude", "skills")],
  localAgentDirs: [path.join(home, ".claude", "agents")],
});

const roster = rosterIds(repoRoot);
let driftSkipped = false;
if (roster !== undefined) {
  problems.push(...lintHarnesses(repoRoot, roster), ...minimaxCommittableProblems(repoRoot, roster));
  if (args.includes("--skip-drift")) driftSkipped = true;
  else problems.push(...driftProblems(repoRoot));
}

if (problems.length > 0) {
  for (const p of problems) console.error(`lint-agents: ${p}`);
  console.error(`lint-agents: ${problems.length} problem(s) in ${agents} agent file(s)`);
  process.exitCode = 1;
} else if (driftSkipped) {
  console.error(`lint-agents: structure OK (${agents} agents; ${roster?.length ?? 0} roles x 5 harnesses) but drift NOT verified (--skip-drift); exit 3`);
  process.exitCode = 3;
} else {
  console.log(`lint-agents: OK (${agents} agents${roster === undefined ? "" : `; ${roster.length} roles x 5 harnesses`})`);
}
