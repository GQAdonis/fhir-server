// CLI: rotate .prometheus/agent-ledger.jsonl by month.
//   node dist/rotate-ledger.mjs [<repo-root>] [--before <yyyy-mm>]
// Moves every line whose `ts` falls in a month strictly before `--before`
// (default: the current UTC month) into .prometheus/ledger/<yyyy-mm>.jsonl,
// verbatim and in order, appending to any existing file for that month.
// Lines in the current month, and any line whose `ts` does not parse, stay in
// agent-ledger.jsonl, also verbatim and in order. Resets `.flush-cursor` to 0
// only when something actually moved, since a stale byte offset into a
// shrunk ledger would otherwise misalign the next Karpathy flush.
//
// Replaces the tech lead's hand Edit/Write for rotation
// (`.agent-team/roles/fhir-tech-lead.md` "Owns"): `.prometheus/agent-ledger.jsonl`
// is no longer in that role's write scope.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ledgerDir, ledgerPath, partitionLedgerLines } from "./lib/ledger.mjs";

function currentMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

const args = process.argv.slice(2);
const beforeIdx = args.indexOf("--before");
const before = beforeIdx >= 0 ? args[beforeIdx + 1] : undefined;
const positional = args.filter((a, i) => a !== "--before" && args[i - 1] !== "--before");
const root = positional[0] ?? process.cwd();

if (beforeIdx >= 0 && (before === undefined || !/^\d{4}-\d{2}$/.test(before))) {
  console.error("rotate-ledger: --before requires a yyyy-mm value");
  process.exit(1);
}

const file = ledgerPath(root);
if (!existsSync(file)) {
  console.log("rotate-ledger: no ledger file; nothing to rotate");
  process.exit(0);
}

const lines = readFileSync(file, "utf8").split("\n").filter((l) => l !== "");
const { rotated, kept } = partitionLedgerLines(lines, before ?? currentMonth(new Date()));

if (rotated.size === 0) {
  console.log(`rotate-ledger: nothing before ${before ?? currentMonth(new Date())}; nothing to rotate`);
  process.exit(0);
}

const dir = ledgerDir(root);
mkdirSync(dir, { recursive: true });
let moved = 0;
for (const [month, monthLines] of [...rotated.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  appendFileSync(path.join(dir, `${month}.jsonl`), monthLines.map((l) => `${l}\n`).join(""));
  moved += monthLines.length;
}
writeFileSync(file, kept.length > 0 ? `${kept.join("\n")}\n` : "");
writeFileSync(path.join(root, ".prometheus", ".flush-cursor"), `${JSON.stringify({ offset: 0 })}\n`);
console.log(`rotate-ledger: moved ${moved} line(s) into ${rotated.size} month file(s); ${kept.length} line(s) kept in agent-ledger.jsonl`);
