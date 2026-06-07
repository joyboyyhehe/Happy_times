/**
 * EmptyState — Centered empty/no-data illustration.
 * @param {string} emoji - Large emoji icon
 * @param {string} title - Bold title text
 * @param {string} subtitle - Secondary description
 * @param {function} [onAction] - Optional CTA button handler
 * @param {string} [actionLabel] - CTA button label (default 'Refresh')
 */
export default function EmptyState({ emoji = '📭', title, subtitle, onAction, actionLabel = 'Refresh' }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{emoji}</div>
      {title && <p className="empty-state-title">{title}</p>}
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'var(--font)',
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
