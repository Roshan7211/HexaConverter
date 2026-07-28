'use client';

import { useState } from 'react';

import { BadgeCheck, MailWarning, Send } from 'lucide-react';
import { toast } from 'sonner';

import { resendVerification } from '@/api/client/auth.client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/utils';

/** Confirmation state for the account's address, with a way to re-send. */
export function EmailVerificationCard({
  email,
  verifiedAt,
  mailEnabled,
}: {
  email: string;
  verifiedAt: Date | null;
  /** False when the deployment has no SMTP transport, so resending is futile. */
  mailEnabled: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    try {
      const result = await resendVerification(email);
      setSent(true);
      toast.success(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The link could not be sent. Check your connection.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Email address</CardTitle>
          {verifiedAt ? (
            <Badge
              variant="outline"
              className="gap-1 border-success/40 text-success"
            >
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              Confirmed
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-warning/40 text-warning"
            >
              <MailWarning className="size-3.5" aria-hidden="true" />
              Not confirmed
            </Badge>
          )}
        </div>
        <CardDescription>
          {verifiedAt
            ? `${email} — confirmed on ${formatDate(verifiedAt, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}.`
            : `${email} — confirm this address so you can recover your account if you forget your password.`}
        </CardDescription>
      </CardHeader>

      {verifiedAt ? null : (
        <CardContent>
          {mailEnabled ? (
            <Button
              variant="outline"
              loading={sending}
              disabled={sent}
              onClick={() => void resend()}
            >
              <Send aria-hidden="true" />
              {sent ? 'Link sent — check your inbox' : 'Send confirmation link'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Outbound email is not configured on this deployment, so
              confirmation links cannot be sent right now.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
