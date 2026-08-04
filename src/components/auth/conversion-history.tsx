import Link from 'next/link';

import { ArrowRight, FileClock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn, formatBytes, formatRelativeTime, truncateFilename } from '@/utils';

/**
 * The account's conversions, newest first.
 *
 * Deliberately not a download list. Outputs are swept on the retention schedule
 * long before this history is, so most rows here point at a file that no longer
 * exists — offering a download button that mostly fails would be worse than
 * showing none. What survives is the record of what was converted, which is
 * what someone signs in for.
 */

/**
 * Only what this list renders.
 *
 * Declared here rather than imported from the repository on purpose: components
 * are not allowed to reach into `@/database`, and an architecture test enforces
 * it. Naming the handful of fields actually displayed also means a column added
 * to the table does not silently widen what a component depends on.
 */
export interface HistoryEntry {
  id: string;
  status: string;
  sourceFormat: string;
  targetFormat: string;
  inputName: string;
  inputSize: bigint;
  createdAt: Date;
  expiresAt: Date;
}

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Queued',
  PROCESSING: 'Converting',
  COMPLETED: 'Done',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function ConversionHistory({ jobs }: { jobs: HistoryEntry[] }) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <FileClock
          className="mx-auto size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium">No conversions yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Anything you convert while signed in shows up here, on any device.
        </p>
        <Link
          href="/convert/image"
          className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Convert something
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {jobs.map((job) => {
        const expired = job.expiresAt < new Date();

        return (
          <li
            key={job.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card p-3 text-sm"
          >
            <span className="min-w-0 flex-1 truncate font-medium">
              {truncateFilename(job.inputName, 40)}
            </span>

            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className="px-1.5 py-0 font-mono text-[10px] uppercase"
              >
                {job.sourceFormat}
              </Badge>
              <ArrowRight className="size-3" aria-hidden="true" />
              <Badge
                variant="accent"
                className="px-1.5 py-0 font-mono text-[10px] uppercase"
              >
                {job.targetFormat}
              </Badge>
            </span>

            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(job.inputSize)}
            </span>

            <span
              className={cn(
                'shrink-0 text-xs',
                job.status === 'COMPLETED' && !expired
                  ? 'text-success'
                  : job.status === 'FAILED'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
            >
              {expired && job.status === 'COMPLETED'
                ? 'Expired'
                : (STATUS_LABEL[job.status] ?? job.status)}
            </span>

            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelativeTime(job.createdAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
