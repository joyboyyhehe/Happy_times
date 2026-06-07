import React, { useState, useEffect } from 'react';
import { useLeaves } from '../../hooks/useLeaves.js';
import TabBar from '../../components/TabBar.jsx';
import ExpandableCard from '../../components/ExpandableCard.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Skeleton from '../../components/Skeleton.jsx';

const calculateDays = (from, to) => {
  if (!from || !to) return 0;
  const f = new Date(from);
  const t = new Date(to);
  const diff = t.getTime() - f.getTime();
  if (diff < 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
};

export default function LeaveManagement({ branchId, profileId, profileName, pop }) {
  const [activeTab, setActiveTab] = useState('pending');
  const { leaves, loading, approveLeave, rejectLeave, reload } = useLeaves({
    mode: 'branch',
    branchId,
  });

  useEffect(() => {
    if (branchId) {
      reload();
    }
  }, [branchId, reload]);

  const filteredLeaves = leaves.filter(l => 
    activeTab === 'pending' ? l.status === 'pending' : l.status !== 'pending'
  );

  return (
    <div className="overlay-panel open">
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={pop}>←</button>
        <h2>Leave Requests</h2>
      </div>
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        <TabBar
          tabs={[
            { key: 'pending', label: 'Pending', count: leaves.filter(l => l.status === 'pending').length },
            { key: 'reviewed', label: 'Reviewed', count: leaves.filter(l => l.status !== 'pending').length }
          ]}
          active={activeTab}
          onChange={setActiveTab}
          variant="light"
        />

        <div style={{ marginTop: 16 }} className="flex flex-col gap-10">
          {loading ? (
            <Skeleton type="card" count={3} />
          ) : filteredLeaves.length === 0 ? (
            <EmptyState
              emoji="📝"
              title={activeTab === 'pending' ? "No Pending Leaves" : "No Reviewed Leaves"}
              subtitle="All caught up!"
            />
          ) : (
            filteredLeaves.map(l => {
              const days = calculateDays(l.fromDate, l.toDate);
              const isPending = l.status === 'pending';
              const isApproved = l.status === 'approved';
              const statusColor = isApproved ? 'var(--success)' : isPending ? 'var(--warning)' : 'var(--error)';
              
              const header = (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{l.studentName}</span>
                      <span className={`badge ${l.status === 'approved' ? 'badge-success' : l.status === 'pending' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 10 }}>
                        {l.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                      {l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`} · {days}d
                    </div>
                  </div>
                </div>
              );

              return (
                <ExpandableCard key={l.id} header={header} borderColor={statusColor}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Reason</span>
                      <span style={{ color: 'var(--text-dark)' }}>{l.reason}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Submitted By</span>
                        <span style={{ color: 'var(--text-dark)' }}>{l.parentName || 'Parent'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Class</span>
                        <span style={{ color: 'var(--text-dark)' }}>{l.classId}</span>
                      </div>
                    </div>

                    {isPending ? (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          className="btn"
                          style={{ flex: 1, background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', fontSize: 12, padding: '8px' }}
                          onClick={() => rejectLeave(l.id, profileId, profileName || 'Branch Admin')}
                        >
                          Reject
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ flex: 1, fontSize: 12, padding: '8px' }}
                          onClick={() => approveLeave(l.id, profileId, profileName || 'Branch Admin')}
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: 'var(--bg)', padding: 8, borderRadius: 6, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Reviewed by <strong>{l.reviewerName || 'Branch Admin'}</strong> on {l.reviewedAt ? new Date(l.reviewedAt).toLocaleDateString() : '—'}
                      </div>
                    )}
                  </div>
                </ExpandableCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
