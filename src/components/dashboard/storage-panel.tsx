import Link from 'next/link';

import { Clock, HardDrive } from 'lucide-react';

import { Meter } from '@/components/dashboard/charts/meter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { StorageUsage } from '@/types/stats';
import { formatBytes, formatRelativeTime } from '@/utils';

/**
 * Storage usage.
 *
 * Reports what is *currently stored* — converted output inside its retention
 * window — not everything ever converted. Files about to be deleted are listed
 * so the number is actionable rather than merely informative.
 */
export function StoragePanel({ storage }: { storage: StorageUsage }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="size-4 text-primary" aria-hidden="true" />
          Storage
        </CardTitle>
        <CardDescription>
          Converted files are deleted automatically after{' '}
          {storage.retentionHours} hours — this is what is held right now.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Meter
          label="Stored output"
          value={storage.usedBytes}
          max={storage.quotaBytes}
          valueLabel={`${formatBytes(storage.usedBytes)} of ${formatBytes(storage.quotaBytes, 0)}`}
          hint={`${storage.fileCount} file${storage.fileCount === 1 ? '' : 's'}`}
        />

        {storage.expiring.length > 0 ? (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-warning" aria-hidden="true" />
              Expiring within 24 hours
            </p>
            <ul className="mt-3 space-y-2">
              {storage.expiring.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {formatBytes(file.sizeBytes)} ·{' '}
                    <time dateTime={file.expiresAt}>
                      {formatRelativeTime(file.expiresAt)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" asChild className="mt-4">
              <Link href="/dashboard/conversions">Download them now</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing is due to expire in the next 24 hours.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
