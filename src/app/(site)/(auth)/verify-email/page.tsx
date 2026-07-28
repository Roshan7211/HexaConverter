import { Suspense } from 'react';

import type { Metadata } from 'next';

import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { Logo } from '@/components/layout/logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Confirm your email',
  description: 'Confirm the email address on your HexaConverter account.',
  path: '/verify-email',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Confirm your email</CardTitle>
            <CardDescription>
              Confirming your address secures account recovery and lets us reach
              you about your conversions.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Suspense fallback={<Skeleton className="h-56 w-full" />}>
              <VerifyEmailPanel />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
