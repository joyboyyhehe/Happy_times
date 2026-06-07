import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { getBranches, createPost } from '../../services/firestore.js';
import Skeleton from '../../components/Skeleton.jsx';

export default function SuperAdminBroadcastSheet({ open, onClose }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [targetScope, setTargetScope] = useState('all'); // 'all' | 'branch'
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      loadBranches();
    }
  }, [open]);

  async function loadBranches() {
    setLoading(true);
    try {
      const list = await getBranches();
      setBranches(list);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load branches');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (targetScope === 'branch' && !selectedBranchId) {
      toast.error('Please select a target branch');
      return;
    }

    setSending(true);
    try {
      await createPost({
        title: title.trim(),
        body: message.trim(),
        category: 'Circular', // Default circular category for broadcast
        scope: targetScope,
        branchId: targetScope === 'branch' ? selectedBranchId : null,
        authorName: profile?.name || 'Super Admin'
      });
      toast.success('Broadcast notification published successfully!');
      setTitle('');
      setMessage('');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Failed to publish broadcast');
    }
    setSending(false);
  }

  return (
    <div className={`overlay-panel ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={onClose}>←</button>
        <h2>Broadcast Notification</h2>
      </div>

      {/* Content */}
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        {loading ? (
          <Skeleton type="list" count={3} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            {/* Target Select */}
            <div className="input-group">
              <label>Send to Audience</label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: 'var(--surface)',
                  padding: 12,
                  borderRadius: '12px',
                  border: '1px solid rgba(26,35,64,0.08)'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-dark)' }}>
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={targetScope === 'all'}
                    onChange={() => setTargetScope('all')}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>All branches (entire network)</span>
                </label>

                {branches.length > 0 && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.06)' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-dark)' }}>
                      <input
                        type="radio"
                        name="scope"
                        value="branch"
                        checked={targetScope === 'branch'}
                        onChange={() => setTargetScope('branch')}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Specific Branch location</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {targetScope === 'branch' && (
              <div className="input-group">
                <label>Select Branch location *</label>
                <select
                  className="input"
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  required
                >
                  <option value="">Choose Branch...</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Title */}
            <div className="input-group">
              <label>Broadcast Title *</label>
              <input
                type="text"
                className="input"
                placeholder="E.g. Important Safety Notice"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Body */}
            <div className="input-group">
              <label>Message Content *</label>
              <textarea
                className="input"
                placeholder="Write announcement body message here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                style={{ minHeight: 120, fontFamily: 'inherit' }}
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || (targetScope === 'branch' && !selectedBranchId)}
              style={{ marginTop: 8 }}
            >
              {sending ? <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : '📢 Send Broadcast Circular'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
