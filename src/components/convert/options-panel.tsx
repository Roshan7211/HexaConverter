'use client';

import { useState } from 'react';

import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getFormat } from '@/services/conversion/registry';
import type { ConversionOptions } from '@/types/conversion';
import { cn } from '@/utils';

interface OptionsPanelProps {
  sourceFormat: string | null;
  targetFormat: string;
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
  disabled?: boolean;
}

/**
 * Encoder settings for the selected route.
 *
 * Only controls the chosen target actually honours are rendered, so the panel
 * never offers a setting the server would reject.
 */
export function OptionsPanel({
  sourceFormat,
  targetFormat,
  options,
  onChange,
  disabled = false,
}: OptionsPanelProps) {
  const [open, setOpen] = useState(false);

  const target = targetFormat ? getFormat(targetFormat) : null;
  if (!target) return null;

  const set = <K extends keyof ConversionOptions>(
    key: K,
    value: ConversionOptions[K],
  ) => onChange({ ...options, [key]: value });

  const isImageTarget = target.category === 'image' && targetFormat !== 'gif';
  const isGifTarget = targetFormat === 'gif';
  const isAudioTarget = target.category === 'audio';
  const isVideoTarget = target.category === 'video';
  const isArchiveTarget = target.category === 'archive';
  const isPdfTarget = targetFormat === 'pdf';
  const isPdfSource = sourceFormat === 'pdf';

  // WAV and FLAC store samples verbatim. The encoder ignores a bitrate for
  // them, so offering one would be a control that does nothing.
  const isLosslessAudioTarget =
    targetFormat === 'wav' || targetFormat === 'flac';

  // libopus encodes only at 48 kHz and its subdivisions; offering 44.1 kHz
  // here would quietly become 48 kHz on the server.
  const sampleRates: ReadonlyArray<[number, string]> =
    targetFormat === 'opus'
      ? [
          [16000, '16 kHz'],
          [24000, '24 kHz'],
          [48000, '48 kHz'],
        ]
      : [
          [22050, '22.05 kHz'],
          [32000, '32 kHz'],
          [44100, '44.1 kHz'],
          [48000, '48 kHz'],
        ];
  const defaultSampleRate = targetFormat === 'opus' ? 48000 : 44100;

  const hasControls =
    isImageTarget ||
    isGifTarget ||
    isAudioTarget ||
    isVideoTarget ||
    isArchiveTarget ||
    isPdfTarget ||
    isPdfSource;

  if (!hasControls) return null;

  return (
    <div className="rounded-xl border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between px-4 py-3"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="conversion-options"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Conversion settings
        </span>
        <ChevronDown
          className={cn('size-4 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </Button>

      {open ? (
        <div
          id="conversion-options"
          className="grid gap-5 border-t p-4 sm:grid-cols-2"
        >
          {isImageTarget ? (
            <>
              <Field
                label="Quality"
                hint={`${options.quality ?? (targetFormat === 'avif' ? 60 : 82)} / 100 — higher keeps more detail`}
              >
                <Slider
                  value={[
                    options.quality ?? (targetFormat === 'avif' ? 60 : 82),
                  ]}
                  min={20}
                  max={100}
                  step={1}
                  disabled={disabled}
                  onValueChange={([value]) => set('quality', value)}
                  aria-label="Output quality"
                />
              </Field>

              <Field
                label="Max width"
                hint="Leave empty to keep the original size"
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20000}
                  placeholder="Original"
                  disabled={disabled}
                  value={options.width ?? ''}
                  onChange={(event) =>
                    set(
                      'width',
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )
                  }
                />
              </Field>

              <Field
                label="Crop"
                hint="Leave empty to keep the whole image. Values are in source pixels."
              >
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      ['cropX', 'X'],
                      ['cropY', 'Y'],
                      ['cropWidth', 'W'],
                      ['cropHeight', 'H'],
                    ] as const
                  ).map(([key, label]) => (
                    <span key={key} className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {label}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={
                          key === 'cropWidth' || key === 'cropHeight' ? 1 : 0
                        }
                        placeholder="—"
                        disabled={disabled}
                        aria-label={`Crop ${label}`}
                        value={options[key] ?? ''}
                        onChange={(event) =>
                          set(
                            key,
                            event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          )
                        }
                      />
                    </span>
                  ))}
                </div>
              </Field>

              <ToggleField
                label="Remove metadata"
                hint="Strips EXIF data, including GPS coordinates"
                checked={options.stripMetadata ?? true}
                disabled={disabled}
                onChange={(checked) => set('stripMetadata', checked)}
              />

              <ToggleField
                label="Grayscale"
                hint="Converts the image to shades of grey"
                checked={options.grayscale ?? false}
                disabled={disabled}
                onChange={(checked) => set('grayscale', checked)}
              />
            </>
          ) : null}

          {isGifTarget ? (
            <>
              <Field
                label="Frame rate"
                hint="Lower values produce smaller files"
              >
                <Select
                  value={String(options.fps ?? 15)}
                  disabled={disabled}
                  onValueChange={(value) => set('fps', Number(value))}
                >
                  <SelectTrigger aria-label="Frame rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 12, 15, 20, 24, 30].map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Height"
                hint="Width follows the source aspect ratio"
              >
                <Select
                  value={String(options.resolution ?? 480)}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set(
                      'resolution',
                      Number(value) as NonNullable<
                        ConversionOptions['resolution']
                      >,
                    )
                  }
                >
                  <SelectTrigger aria-label="Output height">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[240, 360, 480, 720].map((height) => (
                      <SelectItem key={height} value={String(height)}>
                        {height}p
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}

          {isAudioTarget ? (
            <>
              {isLosslessAudioTarget ? (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  {target.label} stores every sample exactly as recorded, so
                  there is no bitrate to choose. Convert to MP3, AAC, M4A, OGG
                  or Opus to compress.
                </p>
              ) : (
                <Field
                  label="Bitrate"
                  hint="The compression control: fewer kbps, smaller file"
                >
                  <Select
                    value={String(options.audioBitrate ?? 192)}
                    disabled={disabled}
                    onValueChange={(value) =>
                      set('audioBitrate', Number(value))
                    }
                  >
                    <SelectTrigger aria-label="Audio bitrate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[64, 96, 128, 160, 192, 256, 320].map((bitrate) => (
                        <SelectItem key={bitrate} value={String(bitrate)}>
                          {bitrate} kbps
                          {bitrate === 192 ? ' — recommended' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field
                label="Sample rate"
                hint={
                  targetFormat === 'opus'
                    ? 'Opus encodes at 48 kHz and its subdivisions'
                    : '44.1 kHz matches CD audio'
                }
              >
                <Select
                  value={String(options.sampleRate ?? defaultSampleRate)}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set(
                      'sampleRate',
                      Number(value) as NonNullable<
                        ConversionOptions['sampleRate']
                      >,
                    )
                  }
                >
                  <SelectTrigger aria-label="Sample rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleRates.map(([rate, label]) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <ToggleField
                label="Normalise loudness"
                hint="Levels output to the EBU R128 broadcast standard"
                checked={options.normalizeLoudness ?? false}
                disabled={disabled}
                onChange={(checked) => set('normalizeLoudness', checked)}
              />
            </>
          ) : null}

          {isVideoTarget ? (
            <>
              <Field
                label="Frame rate"
                hint="Keep the source rate, or cap it to shrink the file"
              >
                <Select
                  value={options.fps ? String(options.fps) : 'source'}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set('fps', value === 'source' ? undefined : Number(value))
                  }
                >
                  <SelectTrigger aria-label="Frame rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Keep original</SelectItem>
                    {[15, 24, 25, 30, 50, 60].map((fps) => (
                      <SelectItem key={fps} value={String(fps)}>
                        {fps} fps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Resolution"
                hint="Downscaling only; sources are never upscaled"
              >
                <Select
                  value={
                    options.resolution ? String(options.resolution) : 'source'
                  }
                  disabled={disabled}
                  onValueChange={(value) =>
                    set(
                      'resolution',
                      value === 'source'
                        ? undefined
                        : (Number(value) as NonNullable<
                            ConversionOptions['resolution']
                          >),
                    )
                  }
                >
                  <SelectTrigger aria-label="Resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Keep original</SelectItem>
                    {[360, 480, 720, 1080, 1440, 2160].map((height) => (
                      <SelectItem key={height} value={String(height)}>
                        {height}p
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Quality (CRF)"
                hint={`${options.crf ?? 23} — lower is better quality and a larger file`}
              >
                <Slider
                  value={[options.crf ?? 23]}
                  min={16}
                  max={34}
                  step={1}
                  disabled={disabled}
                  onValueChange={([value]) => set('crf', value)}
                  aria-label="Constant rate factor"
                />
              </Field>
            </>
          ) : null}

          {isVideoTarget || isAudioTarget || isGifTarget ? (
            <>
              <Field
                label="Trim from"
                hint="Seconds from the start of the source"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  placeholder="0"
                  disabled={disabled}
                  value={options.startSeconds ?? ''}
                  onChange={(event) =>
                    set(
                      'startSeconds',
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )
                  }
                />
              </Field>

              <Field
                label="Trim duration"
                hint="How many seconds to keep. Empty runs to the end."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  step="0.1"
                  placeholder="to the end"
                  disabled={disabled}
                  value={options.durationSeconds ?? ''}
                  onChange={(event) =>
                    set(
                      'durationSeconds',
                      event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    )
                  }
                />
              </Field>
            </>
          ) : null}

          {isPdfSource ? (
            <>
              <Field
                label="Resolution"
                hint="Dots per inch used to render each page"
              >
                <Select
                  value={String(options.dpi ?? 150)}
                  disabled={disabled}
                  onValueChange={(value) => set('dpi', Number(value))}
                >
                  <SelectTrigger aria-label="Render resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[72, 96, 150, 200, 300, 600].map((dpi) => (
                      <SelectItem key={dpi} value={String(dpi)}>
                        {dpi} DPI
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Pages"
                hint='"all", a page number, or a range like 2-5'
              >
                <Input
                  placeholder="all"
                  disabled={disabled}
                  value={options.pages ?? ''}
                  onChange={(event) =>
                    set('pages', event.target.value.trim() || undefined)
                  }
                />
              </Field>
            </>
          ) : null}

          {isPdfTarget && !isPdfSource ? (
            <>
              <Field label="Page size" hint="Applies to the generated PDF">
                <Select
                  value={options.pageSize ?? 'a4'}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set(
                      'pageSize',
                      value as NonNullable<ConversionOptions['pageSize']>,
                    )
                  }
                >
                  <SelectTrigger aria-label="Page size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">US Letter</SelectItem>
                    <SelectItem value="legal">US Legal</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Orientation"
                hint="Portrait suits text, landscape suits wide images"
              >
                <Select
                  value={options.orientation ?? 'portrait'}
                  disabled={disabled}
                  onValueChange={(value) =>
                    set(
                      'orientation',
                      value as NonNullable<ConversionOptions['orientation']>,
                    )
                  }
                >
                  <SelectTrigger aria-label="Orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}

          {isArchiveTarget ? (
            <Field
              label="Compression level"
              hint={`${options.compressionLevel ?? 6} — 0 stores without compressing, 9 is smallest`}
            >
              <Slider
                value={[options.compressionLevel ?? 6]}
                min={0}
                max={9}
                step={1}
                disabled={disabled}
                onValueChange={([value]) => set('compressionLevel', value)}
                aria-label="Compression level"
              />
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
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
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}
