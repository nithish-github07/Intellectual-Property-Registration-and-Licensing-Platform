import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getOwnedTokenIds, fetchLicenseDetails } from "../lib/ownedTokens.js";

const LICENSE_TYPES = ["Personal", "Commercial", "Exclusive"];
const SEPOLIA_CHAIN_ID = "0xaa36a7";

/**
 * Derive a status badge from license data and on-chain validity.
 */
function getLicenseStatus(lic) {
  if (!lic.active) return { label: "Revoked", className: "badge revoked" };
  if (lic.endTime !== 0 && Date.now() / 1000 > lic.endTime)
    return { label: "Expired", className: "badge expired" };
  if (lic.maxUses !== 0 && lic.used >= lic.maxUses)
    return { label: "Exhausted", className: "badge exhausted" };
  if (lic.isValid) return { label: "Valid", className: "badge valid" };
  return { label: "Invalid", className: "badge inactive" };
}

export default function LicenseeVault({
  account,
  isSepolia,
  licenseAddress,
  licenseAbi,
  deployBlock,
}) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingId, setUsingId] = useState(null); // token ID currently being used

  const loadVault = useCallback(async () => {
    if (!account) return;
    if (!isSepolia) {
      setError("Please switch to Sepolia Testnet.");
      return;
    }

    setLoading(true);
    setError("");
    setLicenses([]);

    try {
      const ids = await getOwnedTokenIds(licenseAddress, licenseAbi, account, deployBlock);
      if (ids.length === 0) {
        setLicenses([]);
        setLoading(false);
        return;
      }

      const details = await fetchLicenseDetails(licenseAddress, licenseAbi, ids);
      setLicenses(details);
    } catch (err) {
      setError(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  }, [account, isSepolia, licenseAddress, licenseAbi, deployBlock]);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  async function handleUseLicense(licenseTokenId) {
    if (!window.ethereum) return;
    try {
      // Ensure Sepolia
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId.toLowerCase() !== SEPOLIA_CHAIN_ID.toLowerCase()) {
        setError("Please switch to Sepolia Testnet.");
        return;
      }

      setUsingId(licenseTokenId);
      setError("");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(licenseAddress, licenseAbi, signer);

      const tx = await contract.useLicense(licenseTokenId);
      await tx.wait();

      // Refresh just this license
      const updatedAll = await fetchLicenseDetails(licenseAddress, licenseAbi, [BigInt(licenseTokenId)]);
      setLicenses((prev) =>
        prev.map((lic) =>
          lic.licenseTokenId === licenseTokenId ? updatedAll[0] : lic
        )
      );
    } catch (err) {
      setError(`Use License #${licenseTokenId} failed: ${err.shortMessage || err.message}`);
    } finally {
      setUsingId(null);
    }
  }

  return (
    <section className="portfolio-section">
      <div className="section-header">
        <div>
          <h2>Licensee Vault</h2>
          <p className="muted">
            All License NFTs (IPLIC) held by your connected wallet on Sepolia.
          </p>
        </div>
        <button className="secondary refresh-btn" onClick={loadVault} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && <div className="status-msg">{error}</div>}

      {loading && (
        <div className="card-grid">
          {[1, 2, 3].map((i) => (
            <div className="card skeleton-card" key={i}>
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
              <div className="skeleton-line narrow" />
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && licenses.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎫</div>
          <h3>No Licenses Found</h3>
          <p>Your wallet does not hold any License NFTs on Sepolia yet.</p>
        </div>
      )}

      {!loading && licenses.length > 0 && (
        <div className="card-grid">
          {licenses.map((lic) => {
            const status = getLicenseStatus(lic);
            const isUsing = usingId === lic.licenseTokenId;

            return (
              <div className="card license-card" key={lic.licenseTokenId}>
                <div className="card-header-row">
                  <span className="token-id">IPLIC #{lic.licenseTokenId}</span>
                  <span className={status.className}>{status.label}</span>
                </div>

                <div className="result-row">
                  <span>Parent IP Token</span>
                  <strong>#{lic.parentTokenId}</strong>
                </div>

                <div className="result-row">
                  <span>License Type</span>
                  <strong>{LICENSE_TYPES[lic.licenseType] || "Personal"}</strong>
                </div>

                <div className="result-row">
                  <span>Expiry</span>
                  <strong>
                    {lic.endTime === 0
                      ? "Perpetual"
                      : new Date(lic.endTime * 1000).toLocaleString()}
                  </strong>
                </div>

                <div className="result-row">
                  <span>Uses</span>
                  <strong>
                    {lic.used} / {lic.maxUses === 0 ? "Unlimited" : lic.maxUses}
                  </strong>
                </div>

                {lic.isValid && (
                  <button
                    className="primary use-btn"
                    onClick={() => handleUseLicense(lic.licenseTokenId)}
                    disabled={isUsing}
                  >
                    {isUsing ? "Confirming…" : "Use License Right"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
