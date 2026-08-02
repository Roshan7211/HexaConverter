'use client';

import { useCallback, useId, useRef, useState } from 'react';

import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
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
import { Slider } from '@/components/ui/slider';
import { PurgeButton } from '@/components/archives/purge-button';
import { useArchiveToolkit } from '@/hooks/use-archive-toolkit';
import { useLimits } from '@/hooks/use-limits';
import type { ArchiveOperation, ArchiveTarget } from '@/types/archives';
import { cn, formatBytes, truncateFilename } from '@/utils';

/**
 * The archive manager workspace.
 *
 * One component drives all three operations; the controls shown follow the
 * operation, so the panel never offers a setting the server would reject —
 * there is no password field when packing a plain archive, and no format
 * choice when extracting one.
 */

const TARGET_LABELS: Record<ArchiveTarget, string> = {
  zip: 'ZIP — opens everywhere',
  '7z': '7Z — smallest files',
  tar: 'TAR — no compression',
  tgz: 'TAR.GZ — compressed TAR',
  gz: 'GZIP — a single file only',
};

export function ArchiveWorkspace({
  operation,
}: {
  operation: ArchiveOperation;
}) {
  const { limits } = useLimits();
  const toolkit = useArchiveToolkit(operation, limits.maxFileBytes);

  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [revealed, setRevealed] = useState(false);

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
          'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
        )}
      >
        <CloudUpload
          className="size-8 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">
            Drop {multiple ? 'files' : 'an archive'} here, or click to browse
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {operation === 'EXTRACT'
              ? 'ZIP, RAR, 7Z, TAR, TAR.GZ and GZIP'
              : `Up to ${spec.maxFiles} files, ${formatBytes(limits.maxFileBytes)} each`}
          </p>
        </div>

        <label htmlFor={inputId} className="sr-only">
          {spec.label} input files
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple={multiple}
          accept={spec.accept}
          onChange={(event) => {
            if (event.target.files) toolkit.addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.localId}
              className="flex items-center gap-3 rounded-xl border bg-card p-3"
            >
              <FileArchive
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {truncateFilename(file.name, 44)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)}
                  {file.error ? ` · ${file.error}` : ''}
                </p>
                {!file.ticket && !file.error ? (
                  <Progress value={file.progress} className="mt-2 h-1" />
                ) : null}
              </div>

              {/* A failed upload has no ticket, so the file has to be sent
                  again — offered in place rather than making the user remove
                  the row and find it a second time. */}
              {file.error ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toolkit.retryUpload(file.localId)}
                >
                  <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                  Retry
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${file.name}`}
                onClick={() => toolkit.remove(file.localId)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Operation settings */}
      <div className="grid gap-5 rounded-xl border bg-card p-4 sm:grid-cols-2">
        {operation === 'ARCHIVE' ? (
          <Field label="Archive format" hint="What kind of file to produce">
            <Select
              value={params.target}
              onValueChange={(value) =>
                setParams((current) => ({
                  ...current,
                  target: value as ArchiveTarget,
                }))
              }
            >
              <SelectTrigger aria-label="Archive format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TARGET_LABELS) as ArchiveTarget[]).map(
                  (target) => (
                    <SelectItem key={target} value={target}>
                      {TARGET_LABELS[target]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        {operation !== 'EXTRACT' ? (
          <Field
            label="Compression"
            hint={`${params.compressionLevel} of 9 — higher is smaller but slower`}
          >
            <Slider
              value={[params.compressionLevel]}
              min={0}
              max={9}
              step={1}
              aria-label="Compression level"
              onValueChange={([value]) =>
                setParams((current) => ({
                  ...current,
                  compressionLevel: value ?? 6,
                }))
              }
            />
          </Field>
        ) : null}

        {spec.usesPassword ? (
          <Field
            label={operation === 'EXTRACT' ? 'Password' : 'Set a password'}
            hint={
              operation === 'EXTRACT'
                ? 'Only needed if the archive is protected'
                : 'Without it the archive cannot be opened — it cannot be recovered'
            }
          >
            <div className="flex gap-2">
              <Input
                type={revealed ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={
                  operation === 'EXTRACT' ? 'Leave empty if none' : 'Required'
                }
                value={params.password}
                onChange={(event) =>
                  setParams((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={revealed ? 'Hide password' : 'Show password'}
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </Field>
        ) : null}

        {operation === 'PROTECT' ? (
          <Field
            label="Encryption"
            hint={
              params.encryption === 'aes256'
                ? 'Strong. Needs 7-Zip, WinRAR or Keka to open.'
                : 'Weak but universal — every built-in unzipper opens it.'
            }
          >
            <Select
              value={params.encryption}
              onValueChange={(value) =>
                setParams((current) => ({
                  ...current,
                  encryption: value as 'aes256' | 'zipcrypto',
                }))
              }
            >
              <SelectTrigger aria-label="Encryption method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aes256">AES-256 — recommended</SelectItem>
                <SelectItem value="zipcrypto">
                  ZipCrypto — maximum compatibility
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      {toolkit.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{toolkit.error}</AlertDescription>
        </Alert>
      ) : null}

      {toolkit.busy ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {spec.label} in progress
          </p>
          <Progress value={toolkit.progress} />
        </div>
      ) : null}

      {toolkit.result ? (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {toolkit.result.detail ?? 'Finished'}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {truncateFilename(toolkit.result.name, 40)} ·{' '}
              {formatBytes(toolkit.result.size)}
            </span>
            <Button asChild>
              <a
                href={toolkit.result.downloadUrl}
                download={toolkit.result.name}
              >
                <Download className="mr-2 size-4" aria-hidden="true" />
                Download
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="lg"
          disabled={!toolkit.canRun}
          onClick={() => void toolkit.run()}
        >
          <Sparkles className="mr-2 size-4" aria-hidden="true" />
          {spec.label}
        </Button>

        {files.length > 0 || toolkit.result ? (
          <Button type="button" variant="outline" onClick={toolkit.reset}>
            <RotateCcw className="mr-2 size-4" aria-hidden="true" />
            Start over
          </Button>
        ) : null}

        <PurgeButton onPurged={toolkit.reset} />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Trash2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Uploads and results are deleted automatically when they expire. Delete
        temporary files to remove them straight away.
      </p>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
