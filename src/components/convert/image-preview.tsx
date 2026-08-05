'use client';

import { useEffect, useState } from 'react';

import { ArrowRight, Eye, ImageOff } from 'lucide-react';

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
import { cn, formatBytes } from '@/utils';

/**
 * Before-and-after preview.
 *
 * The source is drawn from the local blob URL, so the thumbnail appears the
 * moment a file is picked — no upload round trip. The result is loaded from the
 * signed download URL, which means the pixels shown are exactly the bytes that
 * will be saved: this is a preview *of the download*, not a client-side
 * approximation of it.
 */

interface Props {
  item: ConversionItem;
  targetFormat: string;
}

/** Reads intrinsic dimensions once an image has loaded. */
function useDimensions(url: string | null) {
  const [dimensions, setDimensions] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setDimensions(null);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled)
        setDimensions(`${image.naturalWidth}×${image.naturalHeight}`);
    };
    image.onerror = () => {
      if (!cancelled) setDimensions(null);
    };
    image.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return dimensions;
}

/**
 * Formats an `<img>` element can actually draw.
 *
 * Anything outside this is described rather than fetched: a PDF or a TIFF put
 * in an `<img>` downloads in full and then renders a broken icon, which is the
 * worst of both.
 */
const RENDERABLE_IN_IMG = new Set([
  'png',
  'jpg',
  'gif',
  'webp',
  'svg',
  'avif',
  'bmp',
]);

export function ImagePreview({ item, targetFormat }: Props) {
  const [failed, setFailed] = useState(false);

  const sourceDimensions = useDimensions(item.previewUrl);
  const resultDimensions = useDimensions(
    item.status === 'completed' ? item.downloadUrl : null,
  );

  if (!item.previewUrl) return null;

  const done = item.status === 'completed' && item.downloadUrl;

  // An allow-list, because the target can be any of 43 formats and only a
  // handful of them are things an <img> can draw. The old deny-list named TIFF
  // and BMP, which got both ends wrong: browsers do render BMP, and every
  // non-image target — PDF above all — sailed through and was fetched in full
  // just to fail. That cost the visitor a whole download of a file they had
  // not asked for yet, twice, and then blamed their browser for it.
  const renderable = RENDERABLE_IN_IMG.has(targetFormat);

  const savings =
    done && item.outputSize && item.size > 0
      ? Math.round(((item.size - item.outputSize) / item.size) * 100)
      : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative size-14 shrink-0 overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Preview ${item.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Eye className="size-4" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{item.name}</DialogTitle>
          <DialogDescription>
            {done
              ? 'The image on the right is the file you will download.'
              : 'Convert the file to compare the result side by side.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="space-y-2">
            <div className="flex items-center justify-center overflow-hidden rounded-xl border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`Original ${item.name}`}
                className="max-h-72 w-auto object-contain"
              />
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Original</span> ·{' '}
              {item.sourceFormat?.toUpperCase()} · {formatBytes(item.size)}
              {sourceDimensions ? ` · ${sourceDimensions}` : ''}
            </figcaption>
          </figure>

          <figure className="space-y-2">
            <div className="flex min-h-[8rem] items-center justify-center overflow-hidden rounded-xl border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2">
              {done && renderable && !failed ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.downloadUrl!}
                  alt={`Converted ${item.outputName ?? item.name}`}
                  className="max-h-72 w-auto object-contain"
                  onError={() => setFailed(true)}
                />
              ) : (
                <span className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
                  <ImageOff className="size-6" aria-hidden="true" />
                  {!done
                    ? 'Not converted yet'
                    : failed
                      ? 'The preview could not be loaded. The file itself is ready to download.'
                      : `A ${targetFormat.toUpperCase()} cannot be shown in a preview like this one. Download it to view the result.`}
                </span>
              )}
            </div>
            <figcaption className="text-center text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Converted</span>
              {done ? (
                <>
                  {' '}
                  · {targetFormat.toUpperCase()} ·{' '}
                  {formatBytes(item.outputSize ?? 0)}
                  {resultDimensions ? ` · ${resultDimensions}` : ''}
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
