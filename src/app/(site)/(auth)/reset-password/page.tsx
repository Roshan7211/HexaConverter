import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
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
  title: 'Set a new password',
  description: 'Choose a new password for your HexaConverter account.',
  path: '/reset-password',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Set a new password</CardTitle>
            <CardDescription>
              Choose something you have not used here before.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* The form reads the token from the query string, so it has to sit
                behind a Suspense boundary. */}
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
