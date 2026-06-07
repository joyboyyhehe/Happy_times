import React from 'react';
import Skeleton from '../../components/Skeleton.jsx';

export default function LogsSection({ logs, hasMore, onLoadMore, loading }) {
  const getLogTheme = (type) => {
    if (type.includes('attendance')) {
      return { icon: '📋', bg: 'rgba(76, 175, 80, 0.12)', color: '#2E7D32', label: 'Attendance' };
    }
    if (type.includes('fee') || type.includes('payment')) {
      return { icon: '💰', bg: 'rgba(255, 152, 0, 0.12)', color: '#EF6C00', label: 'Fees' };
    }
    if (type.includes('post') || type.includes('announcement')) {
      return { icon: '📢', bg: 'rgba(156, 39, 176, 0.12)', color: '#6A1B9A', label: 'Posts' };
    }
    if (type.includes('student') || type.includes('parent')) {
      return { icon: '👨‍🎓', bg: 'rgba(33, 150, 243, 0.12)', color: '#1565C0', label: 'Students' };
    }
    if (type.includes('settings') || type.includes('lock')) {
      return { icon: '⚙️', bg: 'rgba(96, 125, 139, 0.12)', color: '#37474F', label: 'Settings' };
    }
    if (type.includes('user') || type.includes('role') || type.includes('whitelist')) {
      return { icon: '🔑', bg: 'rgba(244, 67, 54, 0.12)', color: '#C62828', label: 'Access' };
    }
    return { icon: '📝', bg: 'rgba(0, 0, 0, 0.05)', color: '#424242', label: 'System' };
  };

  return (
    <div className="flex flex-col gap-10">
      {logs.map(l => {
        const theme = getLogTheme(l.action || l.actionType || '');
        const roleLabel = l.actorRole === 'superadmin' ? 'Super Admin' : 'Branch Admin';
        return (
          <div key={l.id} className="list-item" style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '14px', borderRadius: '16px', border: '1px solid rgba(26,35,64,0.06)' }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: theme.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0
            }}>
              {theme.icon}
            </div>
            <div className="list-item-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  background: theme.bg,
                  color: theme.color,
                  display: 'inline-block'
                }}>
                  {theme.label}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-hint)' }}>
                  {l.timestamp?.toDate?.()?.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) || '—'}
                </span>
              </div>
              <div className="list-item-title" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)', lineHeight: '1.4', marginTop: '2px' }}>
                {l.details}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-hint)' }}>
                Actor: <strong>{l.actorName}</strong> ({roleLabel}) {l.branchId ? `· Branch: ${l.branchId}` : ''}
              </div>
            </div>
          </div>
        );
      })}
      
      {loading && <Skeleton type="list" count={3} />}

      {hasMore && !loading && logs.length > 0 && (
        <button
          className="btn btn-outline"
          onClick={onLoadMore}
          style={{ width: '100%', marginTop: 8 }}
        >
          Load More Activity ↓
        </button>
      )}

      {logs.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-hint)' }}>
          No system logs available.
        </div>
      )}
    </div>
  );
}
