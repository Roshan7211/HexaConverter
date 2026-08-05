'use client';

import { useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, Trash2, Upload, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/**
 * The profile picture, and the controls to change it.
 *
 * Signing in with Google brings a picture along; signing up with an email
 * address does not, which left those accounts with a grey placeholder and no
 * way to do anything about it. An uploaded picture is stored separately from
 * the provider's, so it survives the next sign-in — the provider's photo is
 * refreshed from the token every time and would otherwise overwrite it.
 *
 * The file is sent as a raw body rather than multipart: there is exactly one
 * field, and the server re-encodes whatever arrives, so the envelope buys
 * nothing.
 */

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

export function ProfilePicture({
  photoUrl,
  email,
  hasUpload,
}: {
  photoUrl: string | null;
  email: string;
  hasUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Shown immediately from the chosen file, so the new picture appears before
  // the round trip finishes rather than after it.
  const [preview, setPreview] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const response = await fetch('/api/account/avatar', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? 'That picture could not be saved.');
      }

      toast.success('Picture updated.');
      router.refresh();
    } catch (error) {
      setPreview(null);
      URL.revokeObjectURL(localPreview);
      toast.error(
        error instanceof Error
          ? error.message
          : 'That picture could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch('/api/account/avatar', { method: 'DELETE' });
      if (!response.ok) throw new Error('The picture could not be removed.');

      setPreview(null);
      toast.success('Picture removed.');
      router.refresh();
    } catch {
      toast.error('The picture could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? photoUrl;

  return (
    <section
      // Stacked on a phone. Beside an 80px avatar there is barely 180px left on
      // a 320px screen, which wrapped the description to five lines and pushed
      // the button into a column of its own.
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-5"
      aria-labelledby="picture-heading"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full border bg-muted">
        {shown ? (
          // The source is either an object URL or our own endpoint, already
          // resized to 256px — nothing for the image optimiser to improve.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className="size-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <UserIcon className="size-8" aria-hidden="true" />
          </span>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <h2
          id="picture-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Profile picture
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {hasUpload
            ? 'Shown beside your name. Remove it to go back to the picture from your sign-in provider.'
            : 'Shown beside your name. PNG, JPEG or WebP — it is resized to 256px and stripped of location data.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset first, so choosing the same file twice still fires.
              event.target.value = '';
              if (file) void upload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            {photoUrl ? 'Change picture' : 'Upload a picture'}
          </Button>

          {hasUpload ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          ) : null}
        </div>

        <p className="sr-only">Signed in as {email}</p>
      </div>
    </section>
  );
}
