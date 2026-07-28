import type { PlanTier, UserRole } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      plan: PlanTier;
      /** Whether the address has been confirmed. */
      emailVerified: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role?: UserRole;
    plan?: PlanTier;
    emailVerified?: Date | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    plan?: PlanTier;
    emailVerified?: boolean;
    /**
     * When this session was authenticated, in epoch milliseconds.
     *
     * Distinct from `iat`, which NextAuth rewrites every time it re-encodes the
     * token; revocation is checked against this stable value instead.
     */
    authenticatedAt?: number;
    /** Last time the token was re-validated against the database. */
    checkedAt?: number;
    /** Set once the session has been withdrawn; never unset. */
    revoked?: boolean;
  }
}
