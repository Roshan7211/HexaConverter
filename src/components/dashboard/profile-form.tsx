'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldErrors, updateProfileSchema } from '@/api/schemas';

/** Editing for the one profile field the account actually owns. */
export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const { update } = useSession();

  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = updateProfileSchema.safeParse({ name });
    if (!parsed.success) {
      setError(
        Object.values(fieldErrors(parsed.error))[0] ?? 'Check your name.',
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Your profile could not be updated.');
        return;
      }

      // Pulls the new name into the session token so the header and menu
      // update without a full sign-out.
      await update();
      toast.success('Profile updated.');
      router.refresh();
    } catch {
      setError('Your profile could not be updated. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Display name</CardTitle>
        <CardDescription>
          The name shown on your account and in the header.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="display-name">Your name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(error)}
            />
            {error ? (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            loading={saving}
            disabled={name === initialName}
          >
            <Save aria-hidden="true" />
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
