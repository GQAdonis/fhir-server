// CLI: lint .claude/agents/fhir-*.md against docs/agent-team.md.
//   node .claude/hooks/dist/lint-agents.mjs [<repo-root>]
// Exits 1 listing every problem; 0 with a one-line summary when clean.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintAll } from "./lib/agent-lint.mjs";
// npm runs scripts from .claude/hooks/, so default to the repository that
// contains this script (dist/ -> hooks/ -> .claude/ -> repo).
const repoRoot = process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const home = os.homedir();
const { agents, problems } = lintAll({
    repoRoot,
    localSkillDirs: [path.join(home, ".claude", "skills")],
    localAgentDirs: [path.join(home, ".claude", "agents")],
});
if (problems.length > 0) {
    for (const p of problems)
        console.error(`lint-agents: ${p}`);
    console.error(`lint-agents: ${problems.length} problem(s) in ${agents} agent file(s)`);
    process.exitCode = 1;
}
else {
    console.log(`lint-agents: OK (${agents} agents)`);
}
