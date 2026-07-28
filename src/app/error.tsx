'use client';

import { useEffect } from 'react';

import Link from 'next/link';

import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Route-level error boundary. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest correlates with the server log entry; the message itself is
    // redacted by Next in production.
    console.error('Application error', { digest: error.digest });
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-8" aria-hidden="true" />
      </span>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-pretty text-muted-foreground">
        The page could not be loaded. Trying again usually resolves it — if it
        does not, let us know and include the reference below.
      </p>

      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">
            <Home aria-hidden="true" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
