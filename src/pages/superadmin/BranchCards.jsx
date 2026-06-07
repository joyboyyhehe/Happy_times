import React from 'react';
import Skeleton from '../../components/Skeleton.jsx';

export default function BranchCards({ branches, stats, loading, onSelectBranch }) {
  if (loading) {
    return <Skeleton type="card" count={3} />;
  }

  return (
    <div className="flex flex-col gap-10">
      {branches.map(b => {
        const bMetrics = stats.branchMetrics?.[b.id] || { students: 0, admins: 0, pending: 0 };
        return (
          <div
            key={b.id}
            className="branch-card"
            onClick={() => onSelectBranch(b.id, b.name)}
          >
            <div className="branch-card-header">
              <div className="branch-icon-box">🏫</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Code: {b.id}</div>
              </div>
              <span className="badge" style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: 10, fontWeight: 600 }}>
                ● Active
              </span>
            </div>
            <div className="branch-card-metrics">
              <div className="branch-metric">
                <div className="branch-metric-value">{bMetrics.students}</div>
                <div className="branch-metric-label">Students</div>
              </div>
              <div className="branch-metric">
                <div className="branch-metric-value">{bMetrics.admins || bMetrics.teachers || 0}</div>
                <div className="branch-metric-label">Admins</div>
              </div>
              <div className="branch-metric">
                <div className="branch-metric-value" style={{ color: bMetrics.pending > 0 ? 'var(--warning)' : 'var(--primary)' }}>
                  {bMetrics.pending}
                </div>
                <div className="branch-metric-label">Pending Leaves</div>
              </div>
            </div>
          </div>
        );
      })}
      {branches.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-hint)' }}>
          No branch locations registered.
        </div>
      )}
    </div>
  );
}
