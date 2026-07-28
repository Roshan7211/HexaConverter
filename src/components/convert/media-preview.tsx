'use client';

import { useEffect, useState } from 'react';

import { ArrowRight, FileVideo, Music, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ConversionItem } from '@/hooks/use-conversion';
import { getFormat } from '@/services/conversion/registry';
import { cn, formatBytes, formatDuration } from '@/utils';

/**
 * Before-and-after preview for audio and video.
 *
 * The source plays from the local blob URL, so it is scrubbable before
 * anything is uploaded — which is what makes the trim controls usable: you can
 * find the timestamps you want first. The result plays from the signed
 * download URL, so what you hear is the file you will get.
 */

interface Props {
  item: ConversionItem;
  targetFormat: string;
}

/** Containers browsers can generally play. MKV and AVI are not among them. */
const PLAYABLE = new Set([
  'mp4',
  'webm',
  'mov',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'opus',
  'aac',
  'flac',
  'gif',
]);

/** Reads duration and dimensions from a media element once it has metadata. */
function useMediaInfo(url: string | null, kind: 'video' | 'audio') {
  const [info, setInfo] = useState<{ duration: number; size?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!url) {
      setInfo(null);
      return;
    }

    let cancelled = false;
    const element = document.createElement(kind);

    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      if (cancelled) return;
      const video = element as HTMLVideoElement;
      setInfo({
        duration: element.duration,
        size:
          kind === 'video' && video.videoWidth
            ? `${video.videoWidth}×${video.videoHeight}`
            : undefined,
      });
    };
    element.onerror = () => {
      if (!cancelled) setInfo(null);
    };
    element.src = url;

    return () => {
      cancelled = true;
      element.src = '';
    };
  }, [url, kind]);

  return info;
}

export function MediaPreview({ item, targetFormat }: Props) {
  const sourceSpec = item.sourceFormat ? getFormat(item.sourceFormat) : null;
  const targetSpec = getFormat(targetFormat);

  const kind: 'video' | 'audio' =
    sourceSpec?.category === 'audio' ? 'audio' : 'video';

  const sourceInfo = useMediaInfo(item.previewUrl, kind);
  const resultKind: 'video' | 'audio' =
    targetSpec?.category === 'audio' ? 'audio' : 'video';

  const done = item.status === 'completed' && item.downloadUrl;
  const resultInfo = useMediaInfo(done ? item.downloadUrl : null, resultKind);

  if (!item.previewUrl || !sourceSpec) return null;

  const sourcePlayable = PLAYABLE.has(sourceSpec.id);
  const resultPlayable = Boolean(targetSpec && PLAYABLE.has(targetSpec.id));

  const savings =
    done && item.outputSize && item.size > 0
      ? Math.round(((item.size - item.outputSize) / item.size) * 100)
      : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Preview ${item.name}`}
        >
          {kind === 'audio' ? (
            <Music className="size-5" aria-hidden="true" />
          ) : (
            <FileVideo className="size-5" aria-hidden="true" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="size-4" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{item.name}</DialogTitle>
          <DialogDescription>
            {done
              ? 'The player on the right is the file you will download.'
              : 'Scrub the source to find the timestamps you want to trim to.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="space-y-2">
            <div className="flex min-h-[9rem] items-center justify-center overflow-hidden rounded-xl border bg-black/90 p-1">
              {sourcePlayable ? (
                kind === 'audio' ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={item.previewUrl} controls className="w-full" />
                ) : (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={item.previewUrl}
                    controls
                    preload="metadata"
                    className="max-h-64 w-full"
                  />
                )
              ) : (
                <span className="p-6 text-center text-xs text-muted-foreground">
                  Browsers cannot play {sourceSpec.label} — it will still
                  convert correctly.
                </span>
              )}
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Source</span> ·{' '}
              {sourceSpec.label} · {formatBytes(item.size)}
              {sourceInfo?.size ? ` · ${sourceInfo.size}` : ''}
              {sourceInfo
                ? ` · ${formatDuration(sourceInfo.duration * 1000)}`
                : ''}
            </figcaption>
          </figure>

          <figure className="space-y-2">
            <div className="flex min-h-[9rem] items-center justify-center overflow-hidden rounded-xl border bg-black/90 p-1">
              {done && resultPlayable ? (
                resultKind === 'audio' ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio src={item.downloadUrl!} controls className="w-full" />
                ) : targetFormat === 'gif' ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.downloadUrl!}
                    alt={`Converted ${item.name}`}
                    className="max-h-64 w-auto object-contain"
                  />
                ) : (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    src={item.downloadUrl!}
                    controls
                    preload="metadata"
                    className="max-h-64 w-full"
                  />
                )
              ) : (
                <span className="p-6 text-center text-xs text-muted-foreground">
                  {done
                    ? `Browsers cannot play ${targetSpec?.label ?? targetFormat} — download to view.`
                    : 'Not converted yet'}
                </span>
              )}
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Result</span>
              {done ? (
                <>
                  {' '}
                  · {targetSpec?.label ?? targetFormat.toUpperCase()} ·{' '}
                  {formatBytes(item.outputSize ?? 0)}
                  {resultInfo?.size ? ` · ${resultInfo.size}` : ''}
                  {resultInfo
                    ? ` · ${formatDuration(resultInfo.duration * 1000)}`
                    : ''}
                </>
              ) : null}
            </figcaption>
          </figure>
        </div>

        {done ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="tabular flex items-center gap-2">
              {formatBytes(item.size)}
              <ArrowRight
                className="size-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              {formatBytes(item.outputSize ?? 0)}
              {savings !== null ? (
                <span
                  className={cn(
                    'ml-1 font-medium',
                    savings > 0 ? 'text-success' : 'text-muted-foreground',
                  )}
                >
                  {savings > 0
                    ? `${savings}% smaller`
                    : `${Math.abs(savings)}% larger`}
                </span>
              ) : null}
            </span>

            <Button size="sm" asChild>
              <a
                href={item.downloadUrl!}
                download={item.outputName ?? undefined}
              >
                Download
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
