import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader, ExternalLink, X } from "lucide-react";

const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

/**
 * Toast notification item.
 * @typedef {{ id: number, type: "pending"|"success"|"error", message: string, txHash?: string }} Toast
 */

let toastIdCounter = 0;

/**
 * Hook to manage toast notifications for transaction feedback.
 * Returns [toasts, addToast, removeToast, updateToast].
 */
export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, txHash) => {
    const id = ++toastIdCounter;
    const toast = { id, type, message, txHash };
    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss success/error after 6s
    if (type !== "pending") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id, updates) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        // Auto-dismiss if updated to success/error
        if (updates.type && updates.type !== "pending") {
          setTimeout(() => {
            setToasts((p) => p.filter((x) => x.id !== id));
          }, 6000);
        }
        return updated;
      })
    );
  }, []);

  return [toasts, addToast, removeToast, updateToast];
}

/**
 * Toast container — renders in the bottom-right corner.
 */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <div className="toast__icon">
            {toast.type === "pending" && <Loader size={18} className="toast__spinner" />}
            {toast.type === "success" && <CheckCircle size={18} />}
            {toast.type === "error" && <XCircle size={18} />}
          </div>
          <div className="toast__body">
            <span className="toast__message">{toast.message}</span>
            {toast.txHash && (
              <a
                href={`${ETHERSCAN_BASE}/tx/${toast.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="toast__link"
              >
                View on Etherscan <ExternalLink size={12} />
              </a>
            )}
          </div>
          <button className="toast__close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
