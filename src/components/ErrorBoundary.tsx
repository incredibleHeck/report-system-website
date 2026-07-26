import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root-level error boundary that catches uncaught render errors
 * and displays a recovery UI instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  // Explicit declarations required by useDefineForClassFields:false + experimentalDecorators
  declare props: Readonly<Props>;
  declare state: State;
  declare setState: Component<Props, State>['setState'];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1e1a1b',
            color: '#ffffff',
            fontFamily: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(216, 34, 39, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem',
              fontSize: '2rem',
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontFamily: '"Libre Baskerville", "Times New Roman", Georgia, serif',
              fontSize: '1.5rem',
              marginBottom: '0.75rem',
              color: '#d82227',
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '480px', marginBottom: '1.5rem' }}>
            An unexpected error occurred. Your data is safe — please try refreshing the page.
          </p>
          {this.state.error && (
            <pre
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '600px',
                overflow: 'auto',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'transparent',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#d82227',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
