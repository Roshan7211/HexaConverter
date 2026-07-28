'use client';

import dynamic from 'next/dynamic';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Ban,
  RotateCcw,
  X,
} from 'lucide-react';

// Both open a dialog and only mount for a file that has a preview URL, so
// their code — and the dialog primitive with it — is fetched at that point
// rather than with the row.
const ImagePreview = dynamic(
  () =>
    import('@/components/convert/image-preview').then((m) => m.ImagePreview),
  { ssr: false },
);

const MediaPreview = dynamic(
  () =>
    import('@/components/convert/media-preview').then((m) => m.MediaPreview),
  { ssr: false },
);
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getFormat } from '@/services/conversion/registry';
import type { Category } from '@/types/conversion';
import type { ConversionItem } from '@/hooks/use-conversion';
import { cn, formatBytes, formatDuration, truncateFilename } from '@/utils';

const CATEGORY_ICON: Record<Category, typeof FileImage> = {
  image: FileImage,
  document: FileText,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
};

const STATUS_COPY: Record<ConversionItem['status'], string> = {
  pending: 'Waiting',
  uploading: 'Uploading',
  ready: 'Ready to convert',
  queued: 'Queued',
  processing: 'Converting',
  completed: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
  merged: 'Added to the PDF',
};

interface FileRowProps {
  item: ConversionItem;
  targetFormat: string;
  onRemove: (localId: string) => void;
  onCancel: (localId: string) => void;
  /** Re-sends a file whose upload failed, without re-picking it. */
  onRetryUpload: (localId: string) => void;
}

export function FileRow({
  item,
  targetFormat,
  onRemove,
  onCancel,
  onRetryUpload,
}: FileRowProps) {
  const spec = item.sourceFormat ? getFormat(item.sourceFormat) : null;
  const Icon = spec ? CATEGORY_ICON[spec.category] : FileText;

  const isActive =
    item.status === 'uploading' ||
    item.status === 'queued' ||
    item.status === 'processing';
  const isDone = item.status === 'completed';
  const isError = item.status === 'failed' || item.status === 'cancelled';
  // Folded into another row's combined PDF. It has no result of its own, so the
  // row is dimmed and offers no download rather than implying it produced one.
  const isMerged = item.status === 'merged';

  const savings =
    isDone && item.outputSize && item.size > 0
      ? Math.round(((item.size - item.outputSize) / item.size) * 100)
      : null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'rounded-xl border bg-card p-4',
        isError && 'border-destructive/40',
        isDone && 'border-success/40',
        isMerged && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Previewable files get a thumbnail that opens the before/after
            comparison; everything else falls back to a category icon. */}
        {item.previewUrl && spec?.category === 'image' ? (
          <ImagePreview item={item} targetFormat={targetFormat} />
        ) : null}
        {item.previewUrl &&
        (spec?.category === 'video' || spec?.category === 'audio') ? (
          <MediaPreview item={item} targetFormat={targetFormat} />
        ) : null}

        <span
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg',
            item.previewUrl && 'hidden sm:flex',
            isDone
              ? 'bg-success/10 text-success'
              : isError
                ? 'bg-destructive/10 text-destructive'
                : 'bg-accent text-primary',
          )}
        >
          {isDone ? (
            <CheckCircle2 className="size-5" aria-hidden="true" />
          ) : isError ? (
            <AlertCircle className="size-5" aria-hidden="true" />
          ) : (
            <Icon className="size-5" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium" title={item.name}>
              {truncateFilename(item.name, 42)}
            </p>

            {item.sourceFormat && targetFormat ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 font-mono text-[10px] uppercase"
                >
                  {item.sourceFormat}
                </Badge>
                <ArrowRight className="size-3" aria-hidden="true" />
                <Badge
                  variant="accent"
                  className="px-1.5 py-0 font-mono text-[10px] uppercase"
                >
                  {targetFormat}
                </Badge>
              </span>
            ) : null}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{formatBytes(item.size)}</span>
            {isDone && item.outputSize ? (
              <>
                <ArrowRight className="size-3" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {formatBytes(item.outputSize)}
                </span>
                {savings !== null && savings > 0 ? (
                  <span className="text-success">({savings}% smaller)</span>
                ) : null}
              </>
            ) : null}
            {isDone && item.durationMs ? (
              <span>· {formatDuration(item.durationMs)}</span>
            ) : null}
            {item.combinedCount ? (
              <span className="text-foreground">
                · one PDF from {item.combinedCount} images
              </span>
            ) : null}
            {isMerged ? <span>· page in the combined PDF</span> : null}
          </p>

          <AnimatePresence initial={false}>
            {isActive ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 space-y-1.5"
              >
                <Progress
                  value={item.progress}
                  aria-label={`${STATUS_COPY[item.status]} ${item.name}`}
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  {STATUS_COPY[item.status]}
                  {item.status !== 'queued'
                    ? ` · ${Math.round(item.progress)}%`
                    : null}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {item.error ? (
            <p className="mt-2 text-xs text-destructive" role="status">
              {item.error}
            </p>
          ) : null}

          {item.status === 'ready' && !targetFormat ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Choose an output format to start.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* A failed upload never produced a ticket, so the only way forward
              is to send the bytes again — offered here rather than making the
              user remove the row and find the file a second time. */}
          {item.status === 'failed' && !item.ticket ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetryUpload(item.localId)}
            >
              <RotateCcw aria-hidden="true" />
              <span className="hidden sm:inline">Retry</span>
            </Button>
          ) : null}

          {isDone && item.downloadUrl ? (
            <Button size="sm" asChild>
              <a
                href={item.downloadUrl}
                download={item.outputName ?? undefined}
              >
                <Download aria-hidden="true" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>
          ) : null}

          {item.status === 'queued' || item.status === 'processing' ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onCancel(item.localId)}
              aria-label={`Cancel converting ${item.name}`}
            >
              <Ban aria-hidden="true" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onRemove(item.localId)}
              aria-label={`Remove ${item.name}`}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </motion.li>
  );
}
