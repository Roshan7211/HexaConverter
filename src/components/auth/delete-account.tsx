'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firebaseAuth } from '@/lib/firebase/client';

/**
 * Irreversible, so it asks the person to type their own address first.
 *
 * A confirmation dialog is too easy to click through; typing the address takes
 * deliberate effort and cannot be done by accident or by a mis-aimed tap. The
 * comparison is only a UI guard — the server authorises from the session cookie
 * and never from anything this form sends.
 */
export function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove() {
    if (busy || !matches) return;
    setBusy(true);

    try {
      const response = await fetch('/api/account', { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Could not close the account.');
      }

      // The account is already gone server-side; this just stops the browser
      // SDK holding a token for a user that no longer exists.
      await firebaseAuth()?.signOut().catch(() => undefined);

      toast.success('Your account has been closed.');
      router.push('/');
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Close this account</p>
        <p className="text-sm text-muted-foreground">
          Deletes your sign-in and profile immediately and cannot be undone.
          Files you have converted are not affected — they were never attached
          to your account, and are deleted on their own schedule.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-email">
          Type <span className="font-mono text-foreground">{email}</span> to
          confirm
        </Label>
        <Input
          id="confirm-email"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          disabled={busy}
        />
      </div>

      <Button
        variant="destructive"
        onClick={() => void remove()}
        disabled={!matches || busy}
        loading={busy}
      >
        Close account permanently
      </Button>
    </div>
  );
}
