import { ethers } from "ethers";

export const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

let provider;

/** Shared read-only Sepolia provider: fixed network (no detection retries) and a 15s request timeout. */
export function getReadProvider() {
    if (!provider) {
        const network = ethers.Network.from(11155111);
        const req = new ethers.FetchRequest(SEPOLIA_RPC_URL);
        req.timeout = 15000;
        provider = new ethers.JsonRpcProvider(req, network, { staticNetwork: network, batchMaxCount: 1 });
    }
    return provider;
}