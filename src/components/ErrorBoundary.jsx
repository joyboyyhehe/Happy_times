import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell" style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          background: 'linear-gradient(160deg, #0F0F1A 0%, #1A1528 100%)',
          color: 'white',
          textAlign: 'center',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px', color: 'white' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px', lineHeight: '1.5' }}>
              An unexpected error occurred. Please try reloading the page or retrying your action.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                className="btn btn-outline" 
                style={{ flex: 1, borderColor: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer' }} 
                onClick={this.handleReset}
              >
                Retry
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, background: 'linear-gradient(135deg, #E8451A 0%, #F5A623 100%)', border: 'none', cursor: 'pointer' }} 
                onClick={this.handleReload}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
