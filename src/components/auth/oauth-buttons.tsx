'use client';

import { useState } from 'react';

import { signIn } from 'next-auth/react';

import { Button } from '@/components/ui/button';

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
};

/** OAuth entry points, rendered only for providers configured on the server. */
export function OAuthButtons({
  providers,
  callbackUrl,
}: {
  providers: readonly string[];
  callbackUrl: string;
}) {
  const [pending, setPending] = useState<string | null>(null);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-2">
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          loading={pending === provider}
          onClick={() => {
            setPending(provider);
            void signIn(provider, { callbackUrl });
          }}
        >
          {PROVIDER_LABEL[provider] ?? `Continue with ${provider}`}
        </Button>
      ))}

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs uppercase tracking-wide text-muted-foreground">
            or
          </span>
        </div>
      </div>
    </div>
  );
}
