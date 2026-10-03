const STEP = 20;
const MAX_BATCHES = 50; // up to 1000 tokens

/**
 * List every minted token of an ERC-721 by probing ownerOf(0), ownerOf(1), ...
 * Needs no event logs, so it doesn't depend on block ranges or the RPC's getLogs limits.
 * A revert means "token doesn't exist"; any other error (network, rate limit) is thrown
 * so the UI shows it instead of pretending there is nothing.
 * Returns [{ id: "1", owner: "0x..." }].
 */
export async function listTokens(contract) {
    const out = [];
    for (let b = 0; b < MAX_BATCHES; b++) {
        const ids = Array.from({ length: STEP }, (_, i) => b * STEP + i);
        const found = (
            await Promise.all(
                ids.map(async (id) => {
                    try {
                        return { id: String(id), owner: await contract.ownerOf(id) };
                    } catch (e) {
                        if (e?.code === "CALL_EXCEPTION") return null;
                        throw e;
                    }
                })
            )
        ).filter(Boolean);
        if (found.length === 0) break;
        out.push(...found);
    }
    return out;
}