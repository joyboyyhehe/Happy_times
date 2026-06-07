import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { getAllLeaves, updateLeaveStatus } from '../../services/firestore.js';
import Skeleton from '../../components/Skeleton.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ExpandableCard from '../../components/ExpandableCard.jsx';

export default function AllPendingLeaves({ open, onClose }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    if (open) {
      loadPendingLeaves();
    }
  }, [open]);

  async function loadPendingLeaves() {
    setLoading(true);
    try {
      const list = await getAllLeaves('pending');
      setLeaves(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load pending leaves');
    }
    setLoading(false);
  }

  async function handleReview(leaveId, status) {
    setReviewingId(leaveId);
    try {
      await updateLeaveStatus(leaveId, {
        status,
        reviewerUid: profile?.id,
        reviewerName: profile?.name || 'Super Admin'
      });
      toast.success(`Leave request ${status}`);
      loadPendingLeaves(); // reload list
    } catch (e) {
      console.error(e);
      toast.error(`Failed to update leave status`);
    }
    setReviewingId(null);
  }

  const calculateDays = (from, to) => {
    if (!from || !to) return 0;
    const f = new Date(from);
    const t = new Date(to);
    const diff = t.getTime() - f.getTime();
    if (diff < 0) return 0;
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className={`overlay-panel ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={onClose}>←</button>
        <h2>Pending Leave Requests</h2>
      </div>

      {/* Content */}
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        {loading ? (
          <Skeleton type="card" count={3} />
        ) : leaves.length > 0 ? (
          <div className="flex flex-col gap-10">
            {leaves.map(l => {
              const days = calculateDays(l.fromDate, l.toDate);
              const isReviewing = reviewingId === l.id;

              const header = (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{l.studentName}</span>
                      <span className="badge badge-warning" style={{ fontSize: 9, fontWeight: 600 }}>
                        {l.branchId?.toUpperCase() || 'HT'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                      {l.fromDate === l.toDate ? l.fromDate : `${l.fromDate} → ${l.toDate}`} · {days}d
                    </div>
                  </div>
                </div>
              );

              return (
                <ExpandableCard key={l.id} header={header} borderColor="var(--warning)">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <div>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Reason</span>
                      <span style={{ color: 'var(--text-dark)' }}>{l.reason || 'No reason provided'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Parent</span>
                        <span style={{ color: 'var(--text-dark)' }}>{l.parentName || 'Parent'}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Class</span>
                        <span style={{ color: 'var(--text-dark)' }}>{l.classId}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className="btn-reject"
                        style={{ flex: 1 }}
                        onClick={() => handleReview(l.id, 'rejected')}
                        disabled={isReviewing}
                      >
                        Reject
                      </button>
                      <button
                        className="btn-approve"
                        style={{ flex: 1 }}
                        onClick={() => handleReview(l.id, 'approved')}
                        disabled={isReviewing}
                      >
                        {isReviewing ? <div className="spinner spinner-sm" style={{ borderTopColor: 'var(--success)' }} /> : 'Approve'}
                      </button>
                    </div>
                  </div>
                </ExpandableCard>
              );
            })}
          </div>
        ) : (
          <EmptyState
            emoji="📝"
            title="All Caught Up!"
            subtitle="No pending leave requests found across any branches."
          />
        )}
      </div>
    </div>
  );
}
