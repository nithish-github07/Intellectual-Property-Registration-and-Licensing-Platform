import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onMouseDown={onClose}>
            <div className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
                <div className="modal__head">
                    <h2>{title}</h2>
                    <button className="modal__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}