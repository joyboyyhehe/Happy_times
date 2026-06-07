import React, { useState } from 'react';
import { useToast } from '../../components/Toast.jsx';
import { createPost } from '../../services/firestore.js';
import { auth } from '../../config/firebase.js';
import { CLASSES } from '../../constants/classes.js';

export default function BroadcastSheet({ branchId, profileName, pop }) {
  const toast = useToast();
  const [broadcastScope, setBroadcastScope] = useState('branch');
  const [broadcastClass, setBroadcastClass] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast.error('Please enter both title and message');
      return;
    }
    setSendingBroadcast(true);
    try {
      await createPost({
        title: broadcastTitle,
        body: broadcastMessage,
        category: 'Announcement',
        scope: broadcastScope === 'branch' ? 'branch' : 'class',
        classId: broadcastScope === 'class' ? broadcastClass : null,
        className: broadcastScope === 'class' ? broadcastClass : null,
        branchId,
        imageUrls: [],
        authorUid: auth.currentUser?.uid,
        authorName: profileName || 'Branch Admin',
      });
      toast.success('Broadcast notification sent successfully!');
      setBroadcastTitle('');
      setBroadcastMessage('');
      pop();
    } catch (e) {
      console.error(e);
      toast.error('Failed to send broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="overlay-panel open">
      <div className="overlay-panel-header">
        <button className="overlay-panel-back" onClick={pop}>←</button>
        <h2>Send Broadcast Notification</h2>
      </div>
      <div className="overlay-panel-content" style={{ padding: 16 }}>
        <form onSubmit={handleSendBroadcast} className="flex flex-col gap-12">
          <div className="input-group">
            <label>Audience / Scope</label>
            <select
              className="input"
              value={broadcastScope}
              onChange={e => setBroadcastScope(e.target.value)}
            >
              <option value="branch">Entire Branch Location (All Classes)</option>
              <option value="class">Specific Class</option>
            </select>
          </div>

          {broadcastScope === 'class' && (
            <div className="input-group">
              <label>Select Class</label>
              <select
                className="input"
                value={broadcastClass}
                onChange={e => setBroadcastClass(e.target.value)}
                required
              >
                <option value="">Choose Class</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="input-group">
            <label>Message Title</label>
            <input
              type="text"
              className="input"
              placeholder="E.g. School Closed Tomorrow"
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>Body Message / Details</label>
            <textarea
              className="input"
              placeholder="Enter the notification content here..."
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              style={{ minHeight: 120, fontFamily: 'inherit' }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={sendingBroadcast || (broadcastScope === 'class' && !broadcastClass)}
            style={{ marginTop: 12 }}
          >
            {sendingBroadcast ? (
              <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
            ) : (
              '🔔 Send Broadcast Notification'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
