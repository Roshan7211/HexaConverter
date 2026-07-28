import { Suspense } from 'react';

import type { Metadata } from 'next';

import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Logo } from '@/components/layout/logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { enabledOAuthProviders } from '@/services/auth/auth-options';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Sign in',
  description:
    'Sign in to HexaConverter to see your conversion history and saved shortcuts.',
  path: '/sign-in',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  const providers = enabledOAuthProviders();

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to see your conversion history and saved shortcuts.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <OAuthButtons providers={providers} callbackUrl="/dashboard" />
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <SignInForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
