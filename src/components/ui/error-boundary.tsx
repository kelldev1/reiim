import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Dernier filet : si un rendu jette, on montre un écran de secours au lieu
 * d'une page blanche. `onError` permet de brancher un monitoring plus tard.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, info: React.ErrorInfo) => void },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[reiim] erreur de rendu', error, info.componentStack);
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          backgroundColor: '#0a0710',
          color: '#fafaff',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600 }}>Une erreur est survenue</p>
        <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 420 }}>
          Recharge la page. Si ça continue, réessaie dans quelques minutes.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            borderRadius: 10,
            border: 'none',
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            backgroundColor: '#fafaff',
            color: '#0a0710',
          }}
        >
          Recharger
        </button>
      </div>
    );
  }
}
