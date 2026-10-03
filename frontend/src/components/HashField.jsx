import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

/**
 * Reusable hash / address display with truncation, copy-to-clipboard, and Etherscan link.
 *
 * @param {string} value       – full hash or address string
 * @param {string} [type]      – "address" | "tx" | "hash" (controls Etherscan link type)
 * @param {string} [label]     – optional label above the value
 * @param {number} [prefixLen] – characters to show at start (default 6)
 * @param {number} [suffixLen] – characters to show at end (default 4)
 * @param {boolean} [full]     – if true, show the full value without truncation
 */
export default function HashField({
  value = "",
  type = "hash",
  label,
  prefixLen = 6,
  suffixLen = 4,
  full = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const display = full
    ? value
    : value.length > prefixLen + suffixLen + 3
      ? `${value.slice(0, prefixLen)}…${value.slice(-suffixLen)}`
      : value;

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function getEtherscanUrl() {
    if (type === "address") return `${ETHERSCAN_BASE}/address/${value}`;
    if (type === "tx") return `${ETHERSCAN_BASE}/tx/${value}`;
    return null;
  }

  const etherscanUrl = getEtherscanUrl();

  return (
    <div className="hash-field">
      {label && <span className="hash-field__label">{label}</span>}
      <div className="hash-field__row">
        <code className="hash-field__value" title={value}>
          {display}
        </code>
        <div className="hash-field__actions">
          <button
            className="hash-field__btn"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy to clipboard"}
            aria-label="Copy"
          >
            {copied ? (
              <Check size={14} className="hash-field__icon hash-field__icon--success" />
            ) : (
              <Copy size={14} className="hash-field__icon" />
            )}
          </button>
          {etherscanUrl && (
            <a
              href={etherscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hash-field__btn"
              title="View on Etherscan"
              aria-label="View on Etherscan"
            >
              <ExternalLink size={14} className="hash-field__icon" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
