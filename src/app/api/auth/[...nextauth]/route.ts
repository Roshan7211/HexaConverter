import NextAuth from 'next-auth';

import { authOptions } from '@/services/auth/auth-options';

/** NextAuth catch-all handler for sign-in, callback, session and CSRF routes. */

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
