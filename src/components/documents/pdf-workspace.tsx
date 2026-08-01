'use client';

import { useCallback, useId, useRef, useState } from 'react';

import Link from 'next/link';

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudUpload,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLimits } from '@/hooks/use-limits';
import { usePdfToolkit } from '@/hooks/use-pdf-toolkit';
import type { PdfOperation } from '@/types/documents';
import { cn, formatBytes, truncateFilename } from '@/utils';

/**
 * The document toolkit workspace.
 *
 * One component drives all five operations; the controls shown are derived
 * from the operation, so the panel never offers a setting the server would
 * reject. Merge is the only one that accepts several files, and it is the
 * reason the list is reorderable — page order follows the visible order.
 */
export function PdfWorkspace({ operation }: { operation: PdfOperation }) {
  const { limits } = useLimits();
  const toolkit = usePdfToolkit(operation, limits.maxFileBytes);

  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const { spec, files, params, setParams } = toolkit;
  const multiple = spec.maxFiles > 1;

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (event.dataTransfer.files.length > 0) {
        toolkit.addFiles(event.dataTransfer.files);
      }
    },
    [toolkit],
  );

  return (
    <section className="space-y-5" aria-label={spec.label}>
      {/* Upload surface */}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={onDrop}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          inputRef.current?.click();
        }}
        className={cn(
          'cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-accent'
            : 'border-border bg-card hover:border-primary/50',
        )}
      >
        <span
          className={cn(
            'mx-auto flex size-12 items-center justify-center rounded-2xl transition-colors',
            dragging
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-primary',
          )}
        >
          <CloudUpload className="size-6" aria-hidden="true" />
        </span>

        <p className="mt-4 font-semibold">
          {dragging
            ? 'Drop to upload'
            : multiple
              ? 'Drag PDFs here'
              : 'Drag a PDF here'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or{' '}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm"
            onClick={() => inputRef.current?.click()}
          >
            browse your device
          </Button>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          PDF only · up to {formatBytes(limits.maxFileBytes, 0)} each
          {multiple ? ` · ${spec.minFiles}–${spec.maxFiles} files` : ''}
        </p>

        <label htmlFor={inputId} className="sr-only">
          Choose PDF files
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length)
              toolkit.addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {/* Selected files */}
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={file.localId}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card p-3',
                file.error && 'border-destructive/40',
              )}
            >
              {multiple ? (
                <span className="tabular w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
              ) : null}

              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <FileText className="size-4" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-medium"
                  title={file.name}
                >
                  {truncateFilename(file.name, 44)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                  {file.error ? ` · ${file.error}` : ''}
                </span>
                {!file.ticket && !file.error ? (
                  <Progress
                    value={file.progress}
                    className="mt-1.5 h-1"
                    aria-label={`Uploading ${file.name}`}
                  />
                ) : null}
              </span>

              {multiple ? (
                <span className="flex shrink-0 gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={index === 0 || toolkit.busy}
                    onClick={() => toolkit.move(file.localId, -1)}
                    aria-label={`Move ${file.name} earlier`}
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={index === files.length - 1 || toolkit.busy}
                    onClick={() => toolkit.move(file.localId, 1)}
                    aria-label={`Move ${file.name} later`}
                  >
                    <ArrowDown className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              ) : null}

              {/* A failed upload has no ticket, so the file has to be sent
                  again — offered in place rather than making the user remove
                  the row and find it a second time. */}
              {file.error ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0"
                  disabled={toolkit.busy}
                  onClick={() => toolkit.retryUpload(file.localId)}
                >
                  <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
                  Retry
                </Button>
              ) : null}

              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                disabled={toolkit.busy}
                onClick={() => toolkit.remove(file.localId)}
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Operation controls */}
      {files.length > 0 ? (
        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
          {(operation === 'EXTRACT_PAGES' ||
            operation === 'SPLIT' ||
            operation === 'ROTATE') && (
            <div className="space-y-2">
              <Label htmlFor="pdf-pages">Pages</Label>
              <Input
                id="pdf-pages"
                value={params.pages}
                disabled={toolkit.busy}
                onChange={(event) =>
                  setParams({ ...params, pages: event.target.value })
                }
                placeholder="all"
              />
              <p className="text-xs text-muted-foreground">
                <code>all</code>, or numbers and ranges like{' '}
                <code>1,3,5-9</code>
              </p>
            </div>
          )}

          {operation === 'ROTATE' && (
            <div className="space-y-2">
              <Label htmlFor="pdf-angle">Rotation</Label>
              <Select
                value={String(params.angle)}
                disabled={toolkit.busy}
                onValueChange={(value) =>
                  setParams({
                    ...params,
                    angle: Number(value) as 90 | 180 | 270,
                  })
                }
              >
                <SelectTrigger id="pdf-angle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90">90° clockwise</SelectItem>
                  <SelectItem value="180">180°</SelectItem>
                  <SelectItem value="270">90° anticlockwise</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Added to any rotation the page already has.
              </p>
            </div>
          )}

          {operation === 'SPLIT' && (
            <div className="space-y-2">
              <Label htmlFor="pdf-split">Split into</Label>
              <Select
                value={params.splitMode}
                disabled={toolkit.busy}
                onValueChange={(value) =>
                  setParams({
                    ...params,
                    splitMode: value as 'pages' | 'ranges',
                  })
                }
              >
                <SelectTrigger id="pdf-split">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pages">One file per page</SelectItem>
                  <SelectItem value="ranges">One file per range</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Several files are delivered together as a ZIP.
              </p>
            </div>
          )}

          {operation === 'COMPRESS' && (
            <div className="space-y-2">
              <Label htmlFor="pdf-compression">Compression</Label>
              <Select
                value={params.compression}
                disabled={toolkit.busy}
                onValueChange={(value) =>
                  setParams({
                    ...params,
                    compression: value as 'light' | 'balanced' | 'strong',
                  })
                }
              >
                <SelectTrigger id="pdf-compression">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    Light — keep print quality
                  </SelectItem>
                  <SelectItem value="balanced">
                    Balanced — good for sharing
                  </SelectItem>
                  <SelectItem value="strong">Strong — smallest file</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If the result would be larger, the original is kept instead.
              </p>
            </div>
          )}

          {operation === 'MERGE' && (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Pages are combined in the order shown above. Use the arrows to
              rearrange before merging.
            </p>
          )}
        </div>
      ) : null}

      {/* Run + progress */}
      {files.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            onClick={() => void toolkit.run()}
            disabled={!toolkit.canRun}
            className="flex-1"
          >
            {toolkit.busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {toolkit.busy
              ? 'Working…'
              : toolkit.uploading
                ? 'Uploading…'
                : spec.label}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={toolkit.reset}
            disabled={toolkit.busy}
          >
            <RotateCcw aria-hidden="true" />
            Clear
          </Button>
        </div>
      ) : null}

      {toolkit.busy ? (
        <div className="space-y-2">
          <Progress
            value={toolkit.progress}
            aria-label={`${spec.label} progress`}
          />
          <p className="text-xs text-muted-foreground" role="status">
            {toolkit.status === 'queued'
              ? 'Queued…'
              : `Processing · ${Math.round(toolkit.progress)}%`}
          </p>
        </div>
      ) : null}

      {toolkit.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{toolkit.error}</AlertDescription>
        </Alert>
      ) : null}

      {toolkit.result ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-success/40 bg-success/5 p-5">
          <span className="flex items-center gap-3">
            <CheckCircle2
              className="size-6 shrink-0 text-success"
              aria-hidden="true"
            />
            <span>
              <span className="block text-sm font-medium">
                {spec.label} complete
              </span>
              <span className="block text-xs text-muted-foreground">
                {toolkit.result.name} · {formatBytes(toolkit.result.size)}
              </span>
            </span>
          </span>

          <span className="flex gap-2">
            <Button asChild>
              <a
                href={toolkit.result.downloadUrl}
                download={toolkit.result.name}
              >
                <Download aria-hidden="true" />
                Download
              </a>
            </Button>
            <Button variant="outline" onClick={toolkit.reset}>
              Start over
            </Button>
          </span>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Files are processed on our servers and deleted automatically after{' '}
        {limits.retentionHours} hour{limits.retentionHours === 1 ? '' : 's'}.{' '}
        <Link
          href="/legal/privacy"
          className="text-primary underline-offset-4 hover:underline"
        >
          How we handle your files
        </Link>
      </p>
    </section>
  );
}
