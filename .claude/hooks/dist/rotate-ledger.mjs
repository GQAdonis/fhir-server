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
import { existsSync } from "node:fs";
import { ledgerPath, rotateLedgerNow } from "./lib/ledger.mjs";
function currentMonth(now) {
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
if (!existsSync(ledgerPath(root))) {
    console.log("rotate-ledger: no ledger file; nothing to rotate");
    process.exit(0);
}
const beforeMonth = before ?? currentMonth(new Date());
try {
    const result = rotateLedgerNow(root, beforeMonth);
    if (result === null) {
        console.log("rotate-ledger: no ledger file; nothing to rotate");
        process.exit(0);
    }
    if (result.moved === 0) {
        console.log(`rotate-ledger: nothing before ${beforeMonth}; nothing to rotate`);
        process.exit(0);
    }
    console.log(`rotate-ledger: moved ${result.moved} line(s) into ${result.monthFiles} month file(s)`);
}
catch (err) {
    console.error(`rotate-ledger: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
