import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Github, Mail, ShieldCheck } from 'lucide-react';
import { getServerSession } from 'next-auth';

import { EmailVerificationCard } from '@/components/dashboard/email-verification-card';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { findProfile } from '@/database/repositories/user.repository';
import { PLAN_LABEL } from '@/lib/plans';
import { buildMetadata } from '@/lib/seo';
import { authOptions } from '@/services/auth/auth-options';
import { isMailEnabled } from '@/services/mail/mail.service';
import { formatDate } from '@/utils';

export const metadata: Metadata = buildMetadata({
  title: 'Your profile',
  description: 'Your name, email address and connected sign-in methods.',
  path: '/dashboard/profile',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/dashboard/profile');

  const user = await findProfile(session.user.id);
  // The session outlived the account — the only sane destination is sign-in.
  if (!user) redirect('/sign-in');

  const initials = (user.name?.trim() || user.email.split('@')[0] || 'U')
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const providers = user.accounts.map((account) => account.provider);

  return (
    <div className="container max-w-3xl py-10 lg:py-14">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 text-sm text-muted-foreground"
      >
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">Profile</li>
        </ol>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-muted-foreground">
        Your identity on HexaConverter. Passwords, sessions and deletion live in{' '}
        <Link
          href="/dashboard/settings"
          className="text-primary underline-offset-4 hover:underline"
        >
          settings
        </Link>
        .
      </p>

      <div className="mt-8 space-y-6">
        <Card>
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              {user.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold">
                  {user.name ?? 'Your account'}
                </h2>
                <Badge variant={user.plan === 'FREE' ? 'outline' : 'default'}>
                  {PLAN_LABEL[user.plan]}
                </Badge>
              </div>

              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                {user.email}
              </p>

              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                Member since{' '}
                {formatDate(user.createdAt, { year: 'numeric', month: 'long' })}
              </p>
            </div>
          </CardContent>
        </Card>

        <ProfileForm initialName={user.name ?? ''} />

        <EmailVerificationCard
          email={user.email}
          verifiedAt={user.emailVerified}
          mailEnabled={isMailEnabled()}
        />

        <Card>
          <CardHeader>
            <CardTitle>Sign-in methods</CardTitle>
            <CardDescription>
              How you can get into this account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2.5">
                <ShieldCheck
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>
                  Email and password
                  {user.passwordHash ? '' : ' — not set up'}
                </span>
              </li>

              {providers.map((provider) => (
                <li key={provider} className="flex items-center gap-2.5">
                  {provider === 'github' ? (
                    <Github
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  ) : (
                    <Mail
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span>{PROVIDER_LABEL[provider] ?? provider}</span>
                </li>
              ))}
            </ul>

            {providers.length === 0 && !user.passwordHash ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No sign-in method is recorded on this account. Use the password
                reset flow to set one.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
