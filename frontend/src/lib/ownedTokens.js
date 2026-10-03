import { ethers } from "ethers";
import { getReadProvider } from "./rpc.js";
import { listTokens } from "./enumerate.js";

/**
 * IDs of the tokens of an ERC-721 contract currently owned by `wallet`.
 * (deployBlock is accepted for backwards compatibility but no longer needed.)
 */
export async function getOwnedTokenIds(contractAddress, abi, wallet) {
  const contract = new ethers.Contract(contractAddress, abi, getReadProvider());
  const tokens = await listTokens(contract);
  return tokens
    .filter((t) => t.owner.toLowerCase() === wallet.toLowerCase())
    .map((t) => BigInt(t.id));
}

/**
 * Fetch full ContentRecord details for a list of IP token IDs.
 *
 * @param {string} registryAddress
 * @param {string[]} registryAbi
 * @param {string} licenseAddress
 * @param {string[]} licenseAbi
 * @param {bigint[]} tokenIds
 * @returns {Promise<object[]>}
 */
export async function fetchIPDetails(registryAddress, registryAbi, licenseAddress, licenseAbi, tokenIds) {
  const provider = getReadProvider();
  const registry = new ethers.Contract(registryAddress, registryAbi, provider);
  const license = new ethers.Contract(licenseAddress, licenseAbi, provider);

  return Promise.all(
    tokenIds.map(async (tokenId) => {
      const idStr = tokenId.toString();
      const rec = await registry.records(idStr);

      // Try to fetch listing terms (may be all-zero if never set)
      let terms = null;
      try {
        const t = await license.listings(idStr);
        terms = {
          price: ethers.formatEther(t.price),
          duration: Number(t.duration),
          maxUses: Number(t.maxUses),
          licenseType: Number(t.licenseType),
          active: t.active,
        };
      } catch {
        // No terms set yet
      }

      return {
        tokenId: idStr,
        contentHash: rec.contentHash,
        ipfsCid: rec.ipfsCid,
        timestamp: Number(rec.timestamp),
        creator: rec.creator,
        terms,
      };
    })
  );
}

/**
 * Fetch full License NFT details for a list of license token IDs.
 *
 * @param {string} licenseAddress
 * @param {string[]} licenseAbi
 * @param {bigint[]} tokenIds
 * @returns {Promise<object[]>}
 */
export async function fetchLicenseDetails(licenseAddress, licenseAbi, tokenIds) {
  const provider = getReadProvider();
  const license = new ethers.Contract(licenseAddress, licenseAbi, provider);

  return Promise.all(
    tokenIds.map(async (tokenId) => {
      const idStr = tokenId.toString();
      const data = await license.getLicense(idStr);
      const isValid = await license.isLicenseValid(idStr);

      return {
        licenseTokenId: idStr,
        parentTokenId: data.parentTokenId.toString(),
        licensor: data.licensor,
        startTime: Number(data.startTime),
        endTime: Number(data.endTime),
        maxUses: Number(data.maxUses),
        used: Number(data.used),
        licenseType: Number(data.licenseType),
        active: data.active,
        isValid,
      };
    })
  );
}