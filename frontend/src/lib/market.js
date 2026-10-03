import { ethers } from "ethers";
import { getReadProvider } from "./rpc.js";
import { listTokens } from "./enumerate.js";

/** Every registered IP whose creator has opened licensing, newest first. */
export async function getListedIPs(registryAddress, registryAbi, licenseAddress, licenseAbi, deployBlock) {
    const provider = getReadProvider();
    const registry = new ethers.Contract(registryAddress, registryAbi, provider);
    const license = new ethers.Contract(licenseAddress, licenseAbi, provider);
    const ids = (await listTokens(registry)).map((t) => t.id);

    const rows = await Promise.all(
        ids.map(async (id) => {
            try {
                const t = await license.listings(id);
                if (!t.active) return null;
                const rec = await registry.records(id);
                return {
                    tokenId: id,
                    price: ethers.formatEther(t.price),
                    rawPrice: t.price,
                    duration: Number(t.duration),
                    maxUses: Number(t.maxUses),
                    licenseType: Number(t.licenseType),
                    contentHash: rec.contentHash,
                    creator: rec.creator,
                };
            } catch {
                return null;
            }
        })
    );
    return rows.filter(Boolean).sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
}