import React, { useState, useEffect, useCallback } from "react";
import { getOwnedTokenIds, fetchIPDetails } from "../lib/ownedTokens.js";
import { ipfsUrl } from "../ipfs.js";

const LICENSE_TYPES = ["Personal", "Commercial", "Exclusive"];

export default function CreatorPortfolio({
  account,
  isSepolia,
  registryAddress,
  registryAbi,
  licenseAddress,
  licenseAbi,
  deployBlock,
  onManageTerms,
  onRegister,
}) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPortfolio = useCallback(async () => {
    if (!account) return;
    if (!isSepolia) {
      setError("Please switch to Sepolia Testnet.");
      return;
    }

    setLoading(true);
    setError("");
    setTokens([]);

    try {
      const ids = await getOwnedTokenIds(registryAddress, registryAbi, account, deployBlock);
      if (ids.length === 0) {
        setTokens([]);
        setLoading(false);
        return;
      }

      const details = await fetchIPDetails(
        registryAddress,
        registryAbi,
        licenseAddress,
        licenseAbi,
        ids
      );
      setTokens(details);
    } catch (err) {
      setError(err.shortMessage || err.message);
    } finally {
      setLoading(false);
    }
  }, [account, isSepolia, registryAddress, registryAbi, licenseAddress, licenseAbi, deployBlock]);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  return (
    <section className="portfolio-section">
      <div className="section-header">
        <div>
          <h2>Creator Portfolio</h2>
          <p className="muted">
            All IP ownership NFTs (IPCO) held by your connected wallet on Sepolia.
          </p>
        </div>
        <button className="secondary refresh-btn" onClick={loadPortfolio} disabled={loading}>
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
              <div className="skeleton-line narrow" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tokens.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <h3>No IP Assets Found</h3>
          <p>Your wallet does not own any registered IP content NFTs on Sepolia yet.</p>
          {onRegister && <button className="primary empty-cta" onClick={onRegister}>Register your first IP</button>}
        </div>
      )}

      {!loading && tokens.length > 0 && (
        <div className="card-grid">
          {tokens.map((t) => (
            <div className="card ip-card" key={t.tokenId}>
              <div className="card-header-row">
                <span className="token-id">IPCO #{t.tokenId}</span>
              </div>

              <div className="result-row">
                <span>Content Hash</span>
                <code className="hash-truncate">{t.contentHash}</code>
              </div>

              <div className="result-row">
                <span>Registered</span>
                <strong>{new Date(t.timestamp * 1000).toLocaleString()}</strong>
              </div>

              {t.ipfsCid && (
                <div className="result-row">
                  <span>IPFS</span>
                  <a
                    href={ipfsUrl(t.ipfsCid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ipfs-link"
                  >
                    {t.ipfsCid.length > 24 ? t.ipfsCid.slice(0, 12) + "…" + t.ipfsCid.slice(-8) : t.ipfsCid} ↗
                  </a>
                </div>
              )}

              {/* Licensing terms section */}
              {t.terms && (t.terms.active || t.terms.price !== "0.0") ? (
                <div className="terms-block">
                  <div className="terms-title">Licensing Terms</div>
                  <div className="result-row">
                    <span>Status</span>
                    <span className={`badge ${t.terms.active ? "active" : "inactive"}`}>
                      {t.terms.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="result-row">
                    <span>Price</span>
                    <strong>{t.terms.price} ETH</strong>
                  </div>
                  <div className="result-row">
                    <span>Type</span>
                    <strong>{LICENSE_TYPES[t.terms.licenseType] || "Personal"}</strong>
                  </div>
                  <div className="result-row">
                    <span>Duration</span>
                    <strong>
                      {t.terms.duration === 0
                        ? "Perpetual"
                        : `${t.terms.duration / 86400} days`}
                    </strong>
                  </div>
                  <div className="result-row">
                    <span>Max Uses</span>
                    <strong>
                      {t.terms.maxUses === 0 ? "Unlimited" : `${t.terms.maxUses}`}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="terms-block">
                  <div className="terms-title muted">No licensing terms set</div>
                </div>
              )}

              <button
                className="secondary manage-btn"
                onClick={() => onManageTerms(t.tokenId)}
              >
                Edit license terms
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}