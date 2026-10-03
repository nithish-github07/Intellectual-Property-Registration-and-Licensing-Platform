import React from "react";

/**
 * Color-coded status badge for license/listing states.
 *
 * @param {"valid"|"active"|"expired"|"revoked"|"exhausted"|"inactive"|"perpetual"|"personal"|"commercial"|"exclusive"} variant
 * @param {string} [children] – badge label text
 */
export default function StatusBadge({ variant = "inactive", children }) {
  return (
    <span className={`status-badge status-badge--${variant}`}>
      {children}
    </span>
  );
}
