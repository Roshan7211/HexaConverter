'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Client-side session context.
 *
 * `refetchOnWindowFocus` is disabled: sessions are JWT-backed and long-lived,
 * so refetching on every focus adds requests without changing state.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
