import React from 'react';

export default function NetworkStats({ stats, onStaffClick, onLeavesClick }) {
  return (
    <div className="network-stats-row mb-16">
      <div className="network-stat-card">
        <span style={{ fontSize: 18 }}>🎒</span>
        <div className="network-stat-value">{stats.totalStudents || 0}</div>
        <div className="network-stat-label">Students</div>
      </div>
      <div className="network-stat-card" onClick={onStaffClick}>
        <span style={{ fontSize: 18 }}>🔑</span>
        <div className="network-stat-value">{stats.totalAdmins || 0}</div>
        <div className="network-stat-label">Admins</div>
      </div>
      <div className="network-stat-card" onClick={onLeavesClick}>
        <span style={{ fontSize: 18 }}>📋</span>
        <div className="network-stat-value" style={{ color: stats.pendingLeaves > 0 ? 'var(--warning)' : 'var(--success)' }}>
          {stats.pendingLeaves || 0}
        </div>
        <div className="network-stat-label">Pending Leaves</div>
      </div>
    </div>
  );
}
