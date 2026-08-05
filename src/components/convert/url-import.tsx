'use client';

import { useState } from 'react';

import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { importFromUrl } from '@/api/client/uploads.client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Adds a file by pasting a link.
 *
 * The case this exists for is browsing on a device the file is not on — a link
 * in an email opened on a phone, a file sitting on a shared drive. Without it
 * the only answer is "download it first, then come back", which is the point
 * most people give up.
 *
 * What comes back is an ordinary `File`, handed to the same callback the
 * dropzone uses, so limits, format detection, the thumbnail and progress all
 * behave exactly as they do for a dropped file.
 */
export function UrlImport({
  onFile,
  disabled,
}: {
  onFile: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !url.trim()) return;

    setBusy(true);
    try {
      const file = await importFromUrl(url.trim());
      onFile([file]);
      setUrl('');
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'That link could not be imported.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3 text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <Link2 aria-hidden="true" />
          Import from a link
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label htmlFor="import-url" className="sr-only">
        Link to the file
      </label>
      <Input
        id="import-url"
        type="url"
        inputMode="url"
        placeholder="https://example.com/photo.png"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        disabled={busy}
        autoFocus
        className="flex-1"
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !url.trim()}>
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Link2 aria-hidden="true" />
          )}
          {busy ? 'Fetching' : 'Import'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setUrl('');
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
