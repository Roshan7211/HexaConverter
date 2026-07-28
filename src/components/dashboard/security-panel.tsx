'use client';

import { useState } from 'react';

import { AlertTriangle, KeyRound, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';

import { signOutEverywhere } from '@/api/client/auth.client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePasswordSchema, fieldErrors } from '@/api/schemas';

/**
 * Password, active sessions and account deletion.
 *
 * Each of these ends the current session on purpose, so every action here hands
 * off to `signOut` rather than leaving the user on a page whose session is
 * quietly dead.
 */
export function SecurityPanel({ hasPassword }: { hasPassword: boolean }) {
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>(
    {},
  );
  const [savingPassword, setSavingPassword] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordErrors({});

    const form = new FormData(event.currentTarget);
    const parsed = changePasswordSchema.safeParse({
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: String(form.get('newPassword') ?? ''),
    });

    if (!parsed.success) {
      setPasswordErrors(fieldErrors(parsed.error));
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json()) as {
        error?: string;
        message?: string;
        signedOut?: boolean;
      };

      if (!response.ok) {
        toast.error(body.error ?? 'The password could not be changed.');
        return;
      }

      toast.success(body.message ?? 'Password changed.');

      // The server revoked every session, this one included. Leave deliberately
      // instead of waiting to be bounced mid-navigation.
      await signOut({ callbackUrl: '/sign-in' });
    } catch {
      toast.error('The password could not be changed. Check your connection.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function revokeSessions() {
    setRevoking(true);
    try {
      const result = await signOutEverywhere();
      toast.success(result.message);
      await signOut({ callbackUrl: '/sign-in' });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The sessions could not be revoked. Check your connection.',
      );
    } finally {
      setRevoking(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const response = await fetch('/api/account', { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        toast.error(body.error ?? 'The account could not be deleted.');
        return;
      }
      await signOut({ callbackUrl: '/' });
    } catch {
      toast.error('The account could not be deleted. Check your connection.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Use at least 10 characters, including a number or symbol. Changing
              it signs you out on every device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={changePassword}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                />
                {passwordErrors.newPassword ? (
                  <p className="text-xs text-destructive" role="alert">
                    {passwordErrors.newPassword}
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" loading={savingPassword}>
                  <KeyRound aria-hidden="true" />
                  Change password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert variant="info">
          <AlertTitle>Connected account</AlertTitle>
          <AlertDescription>
            You sign in with a connected provider, so there is no password to
            manage here. Change it with your provider instead.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Signs out every browser and device that is currently signed in,
            including this one. Use it if you have signed in somewhere you no
            longer control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            loading={revoking}
            onClick={() => void revokeSessions()}
          >
            <LogOut aria-hidden="true" />
            Sign out on all devices
          </Button>
          <p className="text-xs text-muted-foreground">
            Other devices lose access within a minute.
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently removes your account, your conversion history and every
            file still in storage. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <AlertTriangle aria-hidden="true" />
                Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  Every conversion record and stored file is erased immediately.
                  Type <strong>DELETE</strong> to confirm.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="sr-only">
                  Type DELETE to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(event) => setDeleteConfirm(event.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={deleteConfirm !== 'DELETE'}
                  loading={deleting}
                  onClick={() => void deleteAccount()}
                >
                  Delete permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
