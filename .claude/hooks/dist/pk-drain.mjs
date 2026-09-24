// Background drainer: deliver queued session notes in .prometheus/outbox/ to
// the project knowledge base. Started detached by karpathy-flush; also safe to
// run by hand: `node .claude/hooks/dist/pk-drain.mjs [<project-root>]`.
import { drainOutbox } from "./lib/pk.mjs";
import { appendEntry, makeEntry } from "./lib/ledger.mjs";
import { projectDir } from "./lib/paths.mjs";
const root = process.argv[2] ?? projectDir();
try {
    const report = drainOutbox(root, process.env);
    if (report.delivered > 0 || report.lastError !== undefined) {
        appendEntry(root, makeEntry({
            ts: new Date().toISOString(),
            event: report.lastError === undefined ? "kb_ingested" : "kb_deferred",
            outcome: `delivered:${report.delivered},remaining:${report.remaining}`,
        }));
    }
    process.stdout.write(`pk-drain: delivered ${report.delivered}, remaining ${report.remaining}${report.lastError ? ` (${report.lastError})` : ""}\n`);
}
catch (err) {
    process.stderr.write(`pk-drain: warning: ${err instanceof Error ? err.message : String(err)}\n`);
}
process.exitCode = 0;
