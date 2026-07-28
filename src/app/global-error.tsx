'use client';

/**
 * Last-resort boundary for failures in the root layout. It must render its own
 * <html> and <body> because the layout itself did not render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#ffffff',
          color: '#18181b',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.75rem' }}>
            HexaConverter is temporarily unavailable
          </h1>
          <p
            style={{ margin: '0 0 1.5rem', lineHeight: 1.6, color: '#52525b' }}
          >
            An unexpected error stopped the page from loading. Please try again
            in a moment.
          </p>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: '#71717a',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#fd6e08',
              color: '#1c1917',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
