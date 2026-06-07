/**
 * PostFeedCard — Feed-style post card shared between Branch Admin and Super Admin.
 *
 * Props:
 *   post       {object}   — Firestore post document
 *   onDelete   {function} — called with (postId) when delete is confirmed
 *   showDelete {boolean}  — whether to render the delete button (role-gated by parent)
 */

const CATEGORY_COLORS = {
  announcement: { bg: '#EEF2FF', color: '#4338CA', border: '#C7D2FE' },
  event:        { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  fee:          { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  emergency:    { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
  holiday:      { bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  circular:     { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  general:      { bg: '#F8FAFC', color: '#475569', border: '#E2E8F0' },
};

function relativeTime(ts) {
  if (!ts) return '—';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function scopeLabel(post) {
  if (post.scope === 'all' || post.scope === 'all_branches') return 'All Branches';
  if (post.scope === 'branch') return post.branchId || 'Branch';
  if (post.scope === 'class') return post.classId || post.className || 'Class';
  return post.scope || '—';
}

export default function PostFeedCard({ post, onDelete, showDelete }) {
  const cat = post.category?.toLowerCase() || 'general';
  const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.general;

  function handleDelete() {
    if (window.confirm(`Delete "${post.title}"? This cannot be undone.`)) {
      onDelete?.(post.id);
    }
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      border: '1px solid rgba(26,35,64,0.08)',
      boxShadow: '0 2px 10px rgba(26,35,64,0.06)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s ease',
    }}>
      {/* Image thumbnail */}
      {post.imageUrls?.length > 0 && (
        <div style={{ width: '100%', height: 160, overflow: 'hidden' }}>
          <img
            src={post.imageUrls[0]}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      <div style={{ padding: '14px 16px' }}>
        {/* Top row: category chip + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* Category chip */}
            <span style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.3,
              background: colors.bg,
              color: colors.color,
              border: `1px solid ${colors.border}`,
            }}>
              {post.category || 'General'}
            </span>

            {/* Target chip */}
            <span style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              background: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0',
            }}>
              {scopeLabel(post)}
            </span>

            {/* Scheduled badge */}
            {post.scheduledFor && (
              <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: '#FFF7ED',
                color: '#C2410C',
                border: '1px solid #FED7AA',
              }}>
                🕐 Scheduled
              </span>
            )}
          </div>

          <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0, marginLeft: 8 }}>
            {relativeTime(post.timestamp)}
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--navy)',
          lineHeight: 1.35,
          marginBottom: 6,
        }}>
          {post.title}
        </div>

        {/* Body preview */}
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: 10,
        }}>
          {post.body?.length > 160 ? `${post.body.slice(0, 160)}...` : post.body}
        </div>

        {/* Footer: author + delete */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid rgba(26,35,64,0.06)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>
            by {post.authorName || 'Admin'}
          </span>

          {showDelete && (
            <button
              onClick={handleDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--error-bg)',
                color: 'var(--error)',
                border: '1px solid var(--error-border)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'opacity 0.15s ease',
              }}
            >
              🗑 Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
