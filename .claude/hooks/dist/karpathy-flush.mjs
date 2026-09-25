// Hook: at Stop, SessionEnd and PreCompact, summarize new ledger lines into a
// scanned session note and queue it for the project knowledge base (a detached
// drainer runs `pk ingest`, which is too slow to block on).
// Always exits 0; problems surface as a user-visible warning.
import { allow, runHook, warn } from "./lib/hook-io.mjs";
import { flush } from "./lib/flush.mjs";
import { projectDir } from "./lib/paths.mjs";
await runHook("karpathy-flush", () => {
    const result = flush(projectDir());
    switch (result.status) {
        case "blocked":
            return warn(`karpathy-flush: session note withheld — PHI/secret scan found ${result.matches} match(es); nothing was written to .prometheus/raw/`);
        case "queued":
            return warn(`karpathy-flush: ${result.reason}; session note queued in .prometheus/outbox/`);
        default:
            return allow();
    }
});
