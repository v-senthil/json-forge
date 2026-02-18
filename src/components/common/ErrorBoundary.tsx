/* ===================================================================
 * ErrorBoundary component wraps each module to catch render errors.
 * Prevents one broken module from crashing the entire application.
 * =================================================================== */

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  moduleName?: string;
}

function ErrorFallback({
  error,
  resetErrorBoundary,
  moduleName,
}: {
  error: unknown;
  resetErrorBoundary: () => void;
  moduleName?: string;
}) {
  return (
    <div
      style={{
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        background: 'var(--error-bg)',
        borderRadius: 'var(--radius)',
        margin: '1rem',
      }}
    >
      <AlertTriangle size={40} color="var(--error)" />
      <h3 style={{ color: 'var(--error)', margin: 0 }}>
        {moduleName ? `${moduleName} Error` : 'Something went wrong'}
      </h3>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          textAlign: 'center',
          maxWidth: '400px',
          fontFamily: 'monospace',
        }}
      >
        {error instanceof Error ? error.message : String(error)}
      </p>
      <button
        onClick={resetErrorBoundary}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        <RotateCcw size={14} /> Try Again
      </button>
    </div>
  );
}

export function ErrorBoundaryWrapper({ children, moduleName }: Props) {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => (
        <ErrorFallback {...props} moduleName={moduleName} />
      )}
      onReset={() => {
        // Optionally reset state on retry
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
