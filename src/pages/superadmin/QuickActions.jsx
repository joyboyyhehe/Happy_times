import React from 'react';

export default function QuickActions({ onAddAdmin, onBroadcast, onBranchLogs }) {
  return (
    <div className="quick-actions-row mb-20">
      <button className="quick-action-btn" onClick={onAddAdmin}>
        <span>👤</span>
        <span>Add Branch<br />Admin</span>
      </button>
      <button className="quick-action-btn" onClick={onBroadcast}>
        <span>📢</span>
        <span>Broadcast<br />to All</span>
      </button>
      <button className="quick-action-btn" onClick={onBranchLogs}>
        <span>📋</span>
        <span>Branch<br />Logs</span>
      </button>
    </div>
  );
}
