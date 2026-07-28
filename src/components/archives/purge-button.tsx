'use client';

import { useState } from 'react';

import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { purgeStoredFiles } from '@/api/client/archives.client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Deletes everything the visitor has stored, ahead of the retention sweep.
 *
 * Confirmed first because it is not undoable and it reaches past the current
 * page: results from earlier conversions in this session go too.
 */
export function PurgeButton({ onPurged }: { onPurged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  async function purge() {
    setRunning(true);
    try {
      const result = await purgeStoredFiles();

      toast.success(
        result.files === 0
          ? 'There was nothing left to delete.'
          : `Deleted ${result.files} file${result.files === 1 ? '' : 's'} from ${result.jobs} conversion${result.jobs === 1 ? '' : 's'}.`,
        {
          description:
            result.skipped > 0
              ? `${result.skipped} still running and were left alone.`
              : undefined,
        },
      );

      setOpen(false);
      onPurged?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The files could not be deleted.',
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost">
          <Trash2 className="mr-2 size-4" aria-hidden="true" />
          Delete temporary files
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your temporary files?</DialogTitle>
          <DialogDescription>
            This removes every file you have uploaded and every result you have
            not downloaded yet, across this whole session. It cannot be undone,
            and conversions that are still running are left to finish.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={running}>
              Keep them
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={running}
            onClick={() => void purge()}
          >
            {running ? (
              <Loader2
                className="mr-2 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
            )}
            Delete everything
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
