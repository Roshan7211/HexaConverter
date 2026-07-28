import type { Metadata } from 'next';

import { Check } from 'lucide-react';

import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { Logo } from '@/components/layout/logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { enabledOAuthProviders } from '@/services/auth/auth-options';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Create your free account',
  description:
    'Create a free HexaConverter account to keep a history of your conversions, pin shortcuts and track what is still in storage.',
  path: '/sign-up',
});

/**
 * An account no longer buys a bigger allowance — the limits are the same for
 * everyone — so it is described by what it actually does: remember things.
 */
const ACCOUNT_BENEFITS = [
  'A full history of everything you have converted',
  'Pinned shortcuts for the conversions you repeat',
  'See what is still in storage and clear it early',
  'Notifications when a long conversion finishes',
  'Usage statistics across formats and categories',
] as const;

export const dynamic = 'force-dynamic';

export default function SignUpPage() {
  const providers = enabledOAuthProviders();

  return (
    <div className="container grid min-h-[70vh] items-center gap-12 py-14 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 flex justify-center lg:justify-start">
          <Logo />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>
              Free forever. No card required, no watermarks.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <OAuthButtons providers={providers} callbackUrl="/dashboard" />
            <SignUpForm />
          </CardContent>
        </Card>
      </div>

      <aside
        className="hidden lg:block"
        aria-label="What you get with an account"
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          What an account adds
        </h2>
        <ul className="mt-6 space-y-3">
          {ACCOUNT_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <Check
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              <span className="text-sm text-muted-foreground">{benefit}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted-foreground">
          Your conversion history stays private to your account, and every file
          is still deleted automatically when its retention window ends.
        </p>
      </aside>
    </div>
  );
}
