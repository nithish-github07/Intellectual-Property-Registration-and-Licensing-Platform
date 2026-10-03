import React, { useState, useEffect, useCallback } from "react";
import { getListedIPs } from "../lib/market.js";
import HashField from "./HashField.jsx";
import StatusBadge from "./StatusBadge.jsx";
import Modal from "./Modal.jsx";

const TYPES = ["Personal", "Commercial", "Exclusive"];
const fmtDuration = (s) => (s === 0 ? "Perpetual" : `${Math.round(s / 86400)} days`);
const fmtUses = (n) => (n === 0 ? "Unlimited uses" : `${n} uses`);

function art(hash) {
    const h1 = parseInt(hash.slice(2, 6), 16) % 360;
    const h2 = parseInt(hash.slice(6, 10), 16) % 360;
    const angle = parseInt(hash.slice(10, 12), 16) % 180;
    return { background: `linear-gradient(${angle}deg, hsl(${h1} 70% 45%), hsl(${h2} 75% 30%))` };
}

export default function Marketplace({ account, registryAddress, registryAbi, licenseAddress, licenseAbi, deployBlock, onBuy, onGoLicenses }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sel, setSel] = useState(null);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setItems(await getListedIPs(registryAddress, registryAbi, licenseAddress, licenseAbi, deployBlock));
        } catch (e) {
            setError(e.shortMessage || e.message);
        } finally {
            setLoading(false);
        }
    }, [registryAddress, registryAbi, licenseAddress, licenseAbi, deployBlock]);

    useEffect(() => { load(); }, [load]);

    const open = (item) => { setDone(false); setSel(item); };

    async function confirm() {
        setBusy(true);
        const ok = await onBuy(sel);
        setBusy(false);
        if (ok) setDone(true);
    }

    return (
        <section className="portfolio-section">
            <div className="section-header">
                <div>
                    <h2>Marketplace</h2>
                    <p className="muted">Browse registered work that creators have opened for licensing.</p>
                </div>
                <button className="secondary refresh-btn" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
            </div>

            {error && <div className="status-msg">{error}</div>}

            {loading && (
                <div className="card-grid">
                    {[1, 2, 3].map((i) => (
                        <div className="card skeleton-card" key={i}>
                            <div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line narrow" />
                        </div>
                    ))}
                </div>
            )}

            {!loading && !error && items.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">🛒</div>
                    <h3>Nothing is for license yet</h3>
                    <p>When a creator publishes license terms for their registered work, it appears here.</p>
                </div>
            )}

            {!loading && items.length > 0 && (
                <div className="card-grid">
                    {items.map((it) => {
                        const mine = account && it.creator.toLowerCase() === account.toLowerCase();
                        return (
                            <div className="card listing-card" key={it.tokenId}>
                                <div className="ip-art" style={art(it.contentHash)}><span>#{it.tokenId}</span></div>
                                <div className="listing-body">
                                    <div className="listing-top">
                                        <StatusBadge variant={TYPES[it.licenseType]?.toLowerCase() || "personal"}>{TYPES[it.licenseType] || "Personal"}</StatusBadge>
                                        <span className="price">{it.price} <small>ETH</small></span>
                                    </div>
                                    <p className="listing-meta">{fmtDuration(it.duration)} · {fmtUses(it.maxUses)}</p>
                                    <HashField value={it.creator} type="address" label="Creator" />
                                    <button className={mine ? "secondary" : "primary"} disabled={mine} onClick={() => open(it)}>
                                        {mine ? "Your listing" : "Get license"}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {sel && (
                <Modal title={done ? "License purchased" : `License IP #${sel.tokenId}`} onClose={() => setSel(null)}>
                    {done ? (
                        <div className="success-panel">
                            <p>Your License NFT is in your wallet and listed under My Licenses.</p>
                            <div className="row-actions">
                                <button className="primary" onClick={() => { setSel(null); onGoLicenses(); }}>Open My Licenses</button>
                                <button className="secondary" onClick={() => setSel(null)}>Keep browsing</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="result-row"><span>Type</span><strong>{TYPES[sel.licenseType]}</strong></div>
                            <div className="result-row"><span>Duration</span><strong>{fmtDuration(sel.duration)}</strong></div>
                            <div className="result-row"><span>Usage</span><strong>{fmtUses(sel.maxUses)}</strong></div>
                            <div className="result-row"><span>Price</span><strong>{sel.price} ETH</strong></div>
                            <p className="muted modal-note">Your payment goes straight to the creator's wallet. You receive a License NFT that proves your rights.</p>
                            <button className="primary" disabled={busy} onClick={confirm}>
                                {busy ? "Confirm in your wallet…" : account ? `Pay ${sel.price} ETH` : "Connect wallet and pay"}
                            </button>
                        </>
                    )}
                </Modal>
            )}
        </section>
    );
}