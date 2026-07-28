import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import type { NextResponse } from 'next/server';

import { errors, type ApiErrorBody } from '@/api/responses';
import { authOptions } from '@/services/auth/auth-options';

/**
 * Requires an authenticated session. Returns either the session or the 401 to
 * send, so handlers stay a single early-return away from being safe.
 */
export async function requireSession(): Promise<
  | { authenticated: true; session: Session & { user: { id: string } } }
  | { authenticated: false; response: NextResponse<ApiErrorBody> }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { authenticated: false, response: errors.unauthorized() };
  }

  return {
    authenticated: true,
    session: session as Session & { user: { id: string } },
  };
}
