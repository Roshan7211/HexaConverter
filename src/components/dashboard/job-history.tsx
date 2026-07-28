'use client';

import { useState } from 'react';

import Link from 'next/link';

import {
  ArrowRight,
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteJob, listJobs } from '@/api/client/jobs.client';
import type { JobDto } from '@/api/dto/job.dto';
import type { Category } from '@/types/conversion';
import { cn, formatBytes, formatRelativeTime, truncateFilename } from '@/utils';

/**
 * Conversion history with server-side filtering.
 *
 * Polls only while a job is still running, so an idle dashboard makes no
 * background requests.
 */

const CATEGORY_ICON: Record<Category, typeof FileImage> = {
  image: FileImage,
  document: FileText,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'
> = {
  QUEUED: 'secondary',
  PROCESSING: 'warning',
  COMPLETED: 'success',
  FAILED: 'destructive',
  CANCELLED: 'outline',
  EXPIRED: 'outline',
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

interface JobsResponse {
  jobs: JobDto[];
  nextCursor: string | null;
}

export function JobHistory() {
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]['value']>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<JobsResponse>(
    ['jobs', filter],
    () => listJobs({ status: filter, limit: 25 }),
    {
      // Refresh while anything is still running; otherwise stay quiet.
      refreshInterval: (latest) =>
        latest?.jobs.some(
          (job) => job.status === 'QUEUED' || job.status === 'PROCESSING',
        )
          ? 2_000
          : 0,
      revalidateOnFocus: true,
    },
  );

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteJob(id);
      toast.success('Conversion deleted.');
      await mutate();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'The conversion could not be deleted.',
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => setFilter(value as typeof filter)}
      className="space-y-4"
    >
      <TabsList>
        {FILTERS.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={filter} className="mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
            Your conversions could not be loaded. Refresh the page to try again.
          </p>
        ) : !data || data.jobs.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="space-y-3">
            {data.jobs.map((job) => {
              const Icon = CATEGORY_ICON[job.category] ?? FileText;
              const isActive =
                job.status === 'QUEUED' || job.status === 'PROCESSING';

              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      title={job.inputName}
                    >
                      {truncateFilename(job.inputName, 40)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono uppercase">
                        {job.sourceFormat}
                      </span>
                      <ArrowRight className="size-3" aria-hidden="true" />
                      <span className="font-mono uppercase">
                        {job.targetFormat}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatBytes(job.inputSize)}</span>
                      {job.outputSize ? (
                        <>
                          <ArrowRight className="size-3" aria-hidden="true" />
                          <span>{formatBytes(job.outputSize)}</span>
                        </>
                      ) : null}
                      <span aria-hidden="true">·</span>
                      <time dateTime={job.createdAt}>
                        {formatRelativeTime(job.createdAt)}
                      </time>
                    </p>
                    {job.error ? (
                      <p className="mt-1 text-xs text-destructive">
                        {job.error}
                      </p>
                    ) : null}
                  </div>

                  <Badge
                    variant={STATUS_VARIANT[job.status] ?? 'secondary'}
                    className={cn('shrink-0', isActive && 'gap-1.5')}
                  >
                    {isActive ? (
                      <Loader2
                        className="size-3 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
                    {job.status === 'PROCESSING' ? ` ${job.progress}%` : ''}
                  </Badge>

                  <div className="flex shrink-0 gap-1.5">
                    {job.downloadUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={job.downloadUrl}
                          download={job.outputName ?? undefined}
                        >
                          <Download aria-hidden="true" />
                          <span className="sr-only sm:not-sr-only">
                            Download
                          </span>
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isActive || deleting === job.id}
                      loading={deleting === job.id}
                      onClick={() => void handleDelete(job.id)}
                      aria-label={`Delete conversion of ${job.inputName}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <h3 className="text-base font-semibold tracking-tight">
        {filter === 'all'
          ? 'No conversions yet'
          : `Nothing ${filter} right now`}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Convert a file and it will appear here with its status, size change and
        a download link.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/convert/image">Start a conversion</Link>
      </Button>
    </div>
  );
}
