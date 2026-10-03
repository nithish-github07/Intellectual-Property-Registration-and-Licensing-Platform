import React, { useState } from "react";
import Modal from "./Modal.jsx";

const TYPES = [
    ["Personal", "Individual, non-business use"],
    ["Commercial", "Business and monetised use"],
    ["Exclusive", "Exclusive rights for one licensee"],
];

function Seg({ value, onChange, options }) {
    return (
        <div className="seg" role="group">
            {options.map(([v, label]) => (
                <button key={String(v)} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>{label}</button>
            ))}
        </div>
    );
}

export default function TermsModal({ tokenId, initial, onClose, onSubmit }) {
    const [price, setPrice] = useState(initial?.price ?? "0.01");
    const [timed, setTimed] = useState(initial ? initial.durationDays > 0 : true);
    const [days, setDays] = useState(String(initial?.durationDays || 30));
    const [capped, setCapped] = useState(initial ? initial.maxUses > 0 : true);
    const [uses, setUses] = useState(String(initial?.maxUses || 10));
    const [type, setType] = useState(initial?.licenseType ?? 1);
    const [active, setActive] = useState(initial?.active ?? true);
    const [busy, setBusy] = useState(false);

    const valid = price !== "" && Number(price) >= 0 && (!timed || Number(days) > 0) && (!capped || Number(uses) > 0);

    async function submit() {
        setBusy(true);
        const ok = await onSubmit({
            price,
            durationDays: timed ? parseInt(days, 10) : 0,
            maxUses: capped ? parseInt(uses, 10) : 0,
            type,
            active,
        });
        setBusy(false);
        if (ok) onClose();
    }

    return (
        <Modal title={`License terms for IP #${tokenId}`} onClose={onClose}>
            <div className="form-group">
                <label>Price per license (ETH)</label>
                <input type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="form-group">
                <label>License type</label>
                <div className="type-options">
                    {TYPES.map(([name, hint], i) => (
                        <button key={name} type="button" className={type === i ? "on" : ""} onClick={() => setType(i)}>
                            <b>{name}</b><span>{hint}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="form-group">
                <label>How long does a license last?</label>
                <Seg value={timed} onChange={setTimed} options={[[false, "Forever"], [true, "Limited time"]]} />
                {timed && <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days" placeholder="Days" />}
            </div>
            <div className="form-group">
                <label>How many times can it be used?</label>
                <Seg value={capped} onChange={setCapped} options={[[false, "Unlimited"], [true, "Limited"]]} />
                {capped && <input type="number" min="1" value={uses} onChange={(e) => setUses(e.target.value)} aria-label="Uses" placeholder="Number of uses" />}
            </div>
            <div className="form-group check-row">
                <input id="terms-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <label htmlFor="terms-active">Open for purchase in the Marketplace</label>
            </div>
            <button className="primary" disabled={!valid || busy} onClick={submit}>
                {busy ? "Confirm in your wallet…" : "Publish license terms"}
            </button>
        </Modal>
    );
}