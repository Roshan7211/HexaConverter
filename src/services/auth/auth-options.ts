import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PlanTier, UserRole } from '@prisma/client';
import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';

import { serverEnv, isProduction } from '@/lib/env';
import { logger } from '@/lib/logger';
import { prisma } from '@/database/client';
import * as users from '@/database/repositories/user.repository';
import { credentialsSchema } from '@/api/schemas';
import { verifyPassword } from '@/services/account/account.service';
import { isVerificationRequired } from '@/services/auth/email-verification.service';
import {
  resolveSessionState,
  SESSION_MAX_AGE_SECONDS,
  SESSION_REVALIDATE_MS,
  SESSION_UPDATE_AGE_SECONDS,
} from '@/services/auth/session.service';

/**
 * NextAuth configuration.
 *
 * A JWT session strategy is used because credential sign-in cannot create
 * database sessions, while the Prisma adapter still persists OAuth accounts and
 * verification tokens. Role and plan are copied into the token so authorisation
 * checks in middleware need no database round-trip.
 *
 * Statelessness is walked back where it matters: the `jwt` callback re-checks
 * each token against `session.service`'s revocation watermark on an interval,
 * so a password change, a reset, an explicit sign-out-everywhere or a deleted
 * account takes effect without waiting out the token's 30-day life.
 */

/**
 * A session with no user.
 *
 * `jwt` cannot refuse a token — NextAuth's type requires it to return one — so
 * revocation is expressed here instead. Every guard in the app tests
 * `session?.user?.id`, and an already-expired `expires` stops the client from
 * caching it.
 */
function revokedSession(): Session {
  return { expires: new Date(0).toISOString() } as Session;
}

function oauthProviders() {
  const env = serverEnv();
  const providers = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  return providers;
}

/** Provider ids available in this deployment, for the sign-in UI. */
export function enabledOAuthProviders(): Array<'google' | 'github'> {
  const env = serverEnv();
  const enabled: Array<'google' | 'github'> = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) enabled.push('google');
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) enabled.push('github');
  return enabled;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: serverEnv().NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
    newUser: '/dashboard',
  },

  // Every cookie NextAuth sets is pinned rather than left to defaults, so the
  // security attributes are visible in one place and cannot regress silently
  // with a library update. `__Host-` on the CSRF token forbids a subdomain from
  // writing it, which is what makes the double-submit check meaningful.
  cookies: {
    sessionToken: {
      name: isProduction
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
    csrfToken: {
      name: isProduction
        ? '__Host-next-auth.csrf-token'
        : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
    callbackUrl: {
      name: isProduction
        ? '__Secure-next-auth.callback-url'
        : 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
    // The OAuth state and PKCE verifier are single-request values; `sameSite:
    // lax` is required for the provider's redirect back to carry them.
    state: {
      name: isProduction ? '__Secure-next-auth.state' : 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: 900,
      },
    },
    pkceCodeVerifier: {
      name: isProduction
        ? '__Secure-next-auth.pkce.code_verifier'
        : 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        maxAge: 900,
      },
    },
  },

  providers: [
    ...oauthProviders(),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await users.findByEmail(email.toLowerCase());

        // `verifyPassword` compares against a dummy hash when the account does
        // not exist, so response timing does not reveal registration.
        const valid = await verifyPassword(password, user?.passwordHash);
        if (!user || !user.passwordHash || !valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          plan: user.plan,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Blocks sign-in for an unconfirmed address when the deployment requires
     * verification. Returning a path sends the user somewhere that explains the
     * problem, which `return false` (a bare "access denied") would not.
     */
    async signIn({ user, account }) {
      // OAuth providers have already proven control of the mailbox.
      if (account && account.type !== 'credentials') return true;
      if (!isVerificationRequired()) return true;

      const verified = (user as { emailVerified?: Date | null }).emailVerified;
      if (verified) return true;

      return '/verify-email?status=required';
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role ?? UserRole.USER;
        token.plan = (user as { plan?: PlanTier }).plan ?? PlanTier.FREE;
        token.emailVerified = (user as { emailVerified?: Date | null })
          .emailVerified
          ? true
          : false;

        // Fixed at sign-in and never refreshed, unlike `iat`, which NextAuth
        // rewrites every time the token is re-encoded. Revocation compares
        // against this, so it has to mean "when this session began".
        token.authenticatedAt = Date.now();
        token.checkedAt = Date.now();
        return token;
      }

      if (!token.id) return token;
      if (token.revoked) return token;

      // An explicit `update()` re-checks immediately; otherwise the database is
      // consulted at most once per `SESSION_REVALIDATE_MS`, which is what keeps
      // this off the hot path for ordinary requests.
      const due =
        Date.now() - (token.checkedAt ?? 0) >= SESSION_REVALIDATE_MS ||
        trigger === 'update';
      if (!due) return token;

      const state = await resolveSessionState(
        token.id,
        token.authenticatedAt ?? 0,
      );
      token.checkedAt = Date.now();

      if (state.revoked) {
        token.revoked = true;
        return token;
      }

      token.role = state.role;
      token.plan = state.plan;
      token.name = state.name;
      token.picture = state.image;
      token.emailVerified = Boolean(state.emailVerified);

      return token;
    },

    async session({ session, token }) {
      if (token.revoked || !token.id) return revokedSession();

      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role ?? UserRole.USER;
        session.user.plan = token.plan ?? PlanTier.FREE;
        session.user.emailVerified = token.emailVerified ?? false;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // Only ever redirect within this origin.
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        // Fall through to the base URL.
      }
      return baseUrl;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // A provider that hands us an email has already confirmed the mailbox, so
      // recording that here spares OAuth users a pointless verification round
      // and lets them use a flow that requires verification straight away.
      if (account && account.type !== 'credentials' && user.id) {
        await users.markEmailVerified(user.id).catch((error: unknown) => {
          logger.warn('Could not mark provider email as verified', {
            userId: user.id,
            error,
          });
        });
      }

      logger.info('User signed in', {
        userId: user.id,
        provider: account?.provider,
        isNewUser,
      });
    },
    async signOut({ token }) {
      logger.info('User signed out', { userId: token?.id });
    },
  },

  debug: false,
};
