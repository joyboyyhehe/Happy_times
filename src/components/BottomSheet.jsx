import { useEffect, useRef } from 'react';

/**
 * BottomSheet — Reusable TPS-style slide-up bottom sheet.
 * @param {boolean} open - Whether the sheet is visible
 * @param {function} onClose - Called when backdrop tapped or closed
 * @param {string} [title] - Optional title rendered in body header
 * @param {React.ReactNode} children
 * @param {string} [maxHeight] - CSS max-height override (default '92dvh')
 * @param {boolean} [noHandle] - Hide drag handle
 */
export default function BottomSheet({ open, onClose, title, children, maxHeight, noHandle = false }) {
  const bodyRef = useRef(null);

  // Prevent body scroll bleed when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`overlay-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`bottom-sheet${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {!noHandle && <div className="bottom-sheet-handle" />}

        {title && (
          <div style={{
            padding: '14px 20px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-dark)' }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                color: 'var(--text-hint)',
                cursor: 'pointer',
                padding: 4,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        <div className="bottom-sheet-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </>
  );
}
