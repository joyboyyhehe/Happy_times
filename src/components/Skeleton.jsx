import React from 'react';

export function Skeleton({ type = 'list', count = 3 }) {
  const shimmerStyle = {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 37%, rgba(255,255,255,0.06) 63%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s infinite linear',
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  };

  const renderItem = (index) => {
    if (type === 'card') {
      return (
        <div key={index} className="card mb-12" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ ...shimmerStyle, height: '18px', width: '40%' }} />
          <div style={{ ...shimmerStyle, height: '14px', width: '85%' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '60%' }} />
        </div>
      );
    }

    if (type === 'stat') {
      return (
        <div key={index} className="stat-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div style={{ ...shimmerStyle, height: '24px', width: '50%' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '70%' }} />
        </div>
      );
    }

    // Default: List item
    return (
      <div key={index} className="list-item" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ ...shimmerStyle, width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ ...shimmerStyle, height: '16px', width: '35%' }} />
          <div style={{ ...shimmerStyle, height: '12px', width: '60%' }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {Array.from({ length: count }).map((_, idx) => renderItem(idx))}
    </div>
  );
}

export default Skeleton;
