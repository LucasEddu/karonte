import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', backgroundColor: '#fef2f2', color: '#991b1b', height: '100vh', width: '100vw', boxSizing: 'border-box' }}>
          <h2>Application Crash 💥</h2>
          <p>O React travou devido ao seguinte erro de execução:</p>
          <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>
            <summary>Component Stack trace</summary>
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '4px', fontSize: 12 }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
          </details>
          <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20, cursor: 'pointer' }}>
            Recarregar App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
