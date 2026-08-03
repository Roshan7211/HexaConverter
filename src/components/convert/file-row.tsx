'use client';

import dynamic from 'next/dynamic';

import { motion } from 'framer-motion';
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
//
// The `loading` placeholder is not decoration. `previewUrl` is set the moment
// the file is picked, which immediately hides the fallback icon on mobile,
// while the component behind it is still being fetched. Without something
// holding the slot the row renders 16px shorter and then grows once the chunk
// lands — mid-upload, so it reads as the card resizing on its own. It matches
// the thumbnails' `size-14` exactly.
const previewSlot = () => (
  <div className="size-14 shrink-0 animate-pulse rounded-lg border bg-muted" />
);

const ImagePreview = dynamic(
  () =>
    import('@/components/convert/image-preview').then((m) => m.ImagePreview),
  { ssr: false, loading: previewSlot },
);

const MediaPreview = dynamic(
  () =>
    import('@/components/convert/media-preview').then((m) => m.MediaPreview),
  { ssr: false, loading: previewSlot },
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
        // `relative` and `overflow-hidden` anchor the progress bar to the
        // card's bottom edge and keep it inside the rounded corners.
        'relative overflow-hidden rounded-xl border bg-card p-4',
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
            {/* While the file is in flight the status replaces the size rather
                than joining it. Appending would risk wrapping to a second line
                on a narrow phone, which is the height change this layout is
                built to avoid; the size is back as soon as the job settles. */}
            {isActive ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                {STATUS_COPY[item.status]}
                {item.status !== 'queued'
                  ? ` · ${Math.round(item.progress)}%`
                  : null}
              </span>
            ) : (
              <span>{formatBytes(item.size)}</span>
            )}
            {isDone && item.outputSize ? (
              <>
                <ArrowRight className="size-3" aria-hidden="true" />
                <span className="font-medium text-foreground">
                  {formatBytes(item.outputSize)}
                </span>
                {savings !== null && savings > 0 ? (
                  <span className="hidden text-success min-[400px]:inline">
                    ({savings}% smaller)
                  </span>
                ) : null}
              </>
            ) : null}
            {/* Hidden on the narrowest screens: it is the least useful part of
                the result line and the first thing that pushes it onto a
                second row, which would change the card's height. */}
            {isDone && item.durationMs ? (
              <span className="hidden min-[400px]:inline">
                · {formatDuration(item.durationMs)}
              </span>
            ) : null}
            {item.combinedCount ? (
              <span className="text-foreground">
                · one PDF from {item.combinedCount} images
              </span>
            ) : null}
            {isMerged ? <span>· page in the combined PDF</span> : null}
          </p>

          {item.error ? (
            <p className="mt-2 text-xs text-destructive" role="status">
              {item.error}
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

      {/* Pinned to the card's bottom edge and taken out of the flow entirely.
          It used to sit below the metadata as a block, which grew the card by
          ~40px the moment Convert was pressed and shrank it again on
          completion — every row below, and the Convert button itself, jumped
          twice per conversion. Absolute positioning keeps the card exactly the
          same height from `ready` through to `completed`. */}
      {isActive ? (
        <Progress
          value={item.progress}
          aria-label={`${STATUS_COPY[item.status]} ${item.name}`}
          className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-transparent"
        />
      ) : null}
    </motion.li>
  );
}
