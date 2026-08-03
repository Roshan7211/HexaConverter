'use client';

import dynamic from 'next/dynamic';

import {
  ArrowRight,
  Download,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Dropzone } from '@/components/convert/dropzone';

/**
 * The file list and the encoder controls are split out of the initial bundle.
 *
 * Neither can render until a file has been added — both sit behind
 * `items.length > 0` — yet this component is the main content of 249
 * prerendered landing pages, where most visitors never add one. Loading their
 * code on arrival costs every one of those visitors and helps none of them.
 *
 * `FileList` carries Framer Motion with it, which is the largest single reason
 * this split is worth making.
 *
 * `ssr: false` is safe and deliberate here: there is nothing to server-render
 * when the list is empty, so no markup and no layout shift is involved.
 */
const FileList = dynamic(
  () => import('@/components/convert/file-list').then((m) => m.FileList),
  {
    ssr: false,
    // Reserves one card's worth of space while the chunk is in flight.
    //
    // The list only renders once a file exists, but its code is fetched at that
    // same moment — so the controls below it mounted first, at the position the
    // list was about to take, and were shoved down when the chunk landed. That
    // was the largest remaining layout shift in the flow, and it fired right
    // after picking a file, which is exactly when the eye is on that area.
    //
    // 90px is one file card: `p-4` twice over a 56px media slot. Adding several
    // files at once still settles, but the ordinary case of one no longer does.
    loading: () => <div className="h-[90px] rounded-xl border bg-card" />,
  },
);

const OptionsPanel = dynamic(
  () =>
    import('@/components/convert/options-panel').then((m) => m.OptionsPanel),
  { ssr: false },
);
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConversion } from '@/hooks/use-conversion';
import { useLimits } from '@/hooks/use-limits';
import { acceptAttributeFor } from '@/services/conversion/registry';
import type { Category } from '@/types/conversion';
import { formatBytes } from '@/utils';

export interface ConverterProps {
  /** Narrows the accepted input types; omit to accept everything. */
  category?: Category;
  allowedSourceFormats?: readonly string[];
  initialTarget?: string;
  hint: string;
}

/**
 * The conversion workspace: upload, choose an output format, tune settings and
 * download. Rendered on the category pages and on every per-route landing page.
 */
export function Converter({
  category,
  allowedSourceFormats,
  initialTarget,
  hint,
}: ConverterProps) {
  // Limits arrive after hydration; the guest allowance is the safe default.
  const { limits } = useLimits();

  const conversion = useConversion({
    allowedSourceFormats,
    initialTarget,
    maxFiles: limits.maxBatchFiles,
    maxFileBytes: limits.maxFileBytes,
  });

  const {
    items,
    targetFormat,
    setTargetFormat,
    availableTargets,
    options,
    setOptions,
    addFiles,
    convert,
    cancel,
    remove,
    retryUpload,
    reset,
    canConvert,
    readyCount,
    completed,
    isBusy,
    combinePdf,
    setCombinePdf,
    canCombinePdf,
  } = conversion;

  const firstSource =
    items.find((item) => item.sourceFormat)?.sourceFormat ?? null;

  return (
    <section className="space-y-5" aria-label="File converter">
      <Dropzone
        accept={acceptAttributeFor(category ?? 'all')}
        maxFiles={limits.maxBatchFiles}
        maxFileBytes={limits.maxFileBytes}
        onFiles={addFiles}
        disabled={items.length >= limits.maxBatchFiles}
        hint={hint}
      />

      {items.length > 0 ? (
        <>
          <FileList
            items={items}
            targetFormat={targetFormat}
            onRemove={remove}
            onCancel={cancel}
            onRetryUpload={retryUpload}
          />

          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <label
                  htmlFor="target-format"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Convert to
                </label>
                <Select
                  value={targetFormat}
                  onValueChange={setTargetFormat}
                  disabled={availableTargets.length === 0}
                >
                  <SelectTrigger
                    id="target-format"
                    className="w-full sm:max-w-xs"
                  >
                    <SelectValue
                      placeholder={
                        availableTargets.length === 0
                          ? 'Upload a file first'
                          : 'Choose a format'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label}
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          .{target.id}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={isBusy}
                  aria-label="Clear all files"
                >
                  <RotateCcw aria-hidden="true" />
                  Clear
                </Button>
                <Button
                  size="lg"
                  onClick={() => void convert()}
                  disabled={!canConvert}
                  loading={isBusy && readyCount === 0}
                  className="flex-1 sm:flex-none"
                >
                  <Sparkles aria-hidden="true" />
                  Convert {readyCount > 1 ? `${readyCount} files` : 'file'}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* Only shown when it applies — several images, one PDF target.
                Checked by default, because that is nearly always the intent. */}
            {canCombinePdf ? (
              <div className="mt-4 flex items-start gap-2.5 border-t pt-4">
                <Checkbox
                  id="combine-pdf"
                  checked={combinePdf}
                  onCheckedChange={(value) => setCombinePdf(value === true)}
                  disabled={isBusy}
                />
                <Label
                  htmlFor="combine-pdf"
                  className="text-sm font-normal leading-snug"
                >
                  Combine into a single PDF
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {readyCount} images become one {readyCount}-page document,
                    in the order listed above. Untick to get a separate PDF per
                    image.
                  </span>
                </Label>
              </div>
            ) : null}
          </div>

          <OptionsPanel
            sourceFormat={firstSource}
            targetFormat={targetFormat}
            options={options}
            onChange={setOptions}
            disabled={isBusy}
          />

          {completed.length > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/5 p-4">
              <p className="text-sm">
                <span className="font-medium">
                  {completed.length} files converted.
                </span>{' '}
                <span className="text-muted-foreground">
                  Download each file below — links stay valid while the files
                  are stored.
                </span>
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={completed[0]?.downloadUrl ?? '#'}
                  download={completed[0]?.outputName ?? undefined}
                >
                  <Download aria-hidden="true" />
                  Download first
                </a>
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5 text-success" aria-hidden="true" />
        <span>
          Free · up to {limits.maxBatchFiles} file
          {limits.maxBatchFiles === 1 ? '' : 's'} ·{' '}
          {formatBytes(limits.maxFileBytes, 0)} each · files deleted
          automatically after {limits.retentionHours} hour
          {limits.retentionHours === 1 ? '' : 's'}.
        </span>
      </p>
    </section>
  );
}
