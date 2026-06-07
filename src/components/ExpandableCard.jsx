import { useState } from 'react';

/**
 * ExpandableCard — Animated expand/collapse card.
 * Matches TPS _ExpandableLogTile and leave card patterns.
 *
 * @param {React.ReactNode} header - Always-visible header content (row layout)
 * @param {React.ReactNode} children - Expandable body content
 * @param {string} [borderColor] - Optional left-border accent color
 * @param {boolean} [defaultOpen] - Start expanded
 * @param {string} [className] - Extra class on outer wrapper
 */
export default function ExpandableCard({ header, children, borderColor, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`expandable-card ${className}`}
      style={borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 3 } : undefined}
    >
      <button
        className="expandable-card-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        type="button"
      >
        {/* Header content (caller provides layout) */}
        <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
        <span className={`expandable-chevron${open ? ' open' : ''}`}>⌄</span>
      </button>

      <div className={`expandable-body${open ? ' open' : ''}`}>
        <div className="expandable-body-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
