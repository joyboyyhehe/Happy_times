import React from 'react';

export default function ActionGrid({ push, setTab, leavesPendingCount }) {
  return (
    <div className="action-grid mb-20">
      <button className="action-btn" onClick={() => push('classes')}>
        <div className="action-btn-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>🏫</div>
        <span className="action-btn-label">Classes</span>
      </button>
      <button className="action-btn" onClick={() => push('students')}>
        <div className="action-btn-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>👥</div>
        <span className="action-btn-label">Students</span>
      </button>
      <button className="action-btn" onClick={() => push('leaves')}>
        <div className="action-btn-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>📝</div>
        <span className="action-btn-label">Leaves</span>
        {leavesPendingCount > 0 && <span className="badge-count">{leavesPendingCount}</span>}
      </button>
      <button className="action-btn" onClick={() => setTab('attendance')}>
        <div className="action-btn-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>📋</div>
        <span className="action-btn-label">Attendance</span>
      </button>
      <button className="action-btn" onClick={() => setTab('activity')}>
        <div className="action-btn-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>⏳</div>
        <span className="action-btn-label">Logs</span>
      </button>
    </div>
  );
}
