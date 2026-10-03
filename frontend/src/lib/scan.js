const CHUNK = 10_000;
const BATCH = 8;

const withTimeout = (p, ms) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/**
 * Fetch contract logs fast: try one query for the whole range first (many RPCs
 * allow it for address+topic filters), then fall back to parallel 10k-block chunks.
 */
export async function scanLogs(contract, filter, fromBlock, toBlock) {
    try {
        return await withTimeout(contract.queryFilter(filter, fromBlock || 0, toBlock), 8000);
    } catch {
        /* range too large for this RPC - use chunks */
    }
    const ranges = [];
    for (let from = fromBlock || 0; from <= toBlock; from += CHUNK) {
        ranges.push([from, Math.min(from + CHUNK - 1, toBlock)]);
    }
    const out = [];
    for (let i = 0; i < ranges.length; i += BATCH) {
        const results = await Promise.all(
            ranges.slice(i, i + BATCH).map(([f, t]) =>
                contract.queryFilter(filter, f, t).catch((e) => {
                    console.warn("log chunk failed", f, e.message);
                    return [];
                })
            )
        );
        results.forEach((r) => out.push(...r));
    }
    return out;
}