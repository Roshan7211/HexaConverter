/**
 * Conversion domain types.
 *
 * This module is dependency-free and safe to import from client components —
 * the format catalogue drives both the picker UI and server-side validation.
 */

export const CATEGORIES = [
  'image',
  'document',
  'audio',
  'video',
  'archive',
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * External binary a conversion depends on. `ffmpeg` ships as a bundled static
 * build; these are provided by the runtime image (see Dockerfile) and are
 * probed on first use so unavailable routes can be reported instead of failing
 * mid-conversion. Ghostscript is optional even then: PDF compression falls back
 * to a lossless rewrite without it.
 */
export type Requirement = 'libreoffice' | 'poppler' | 'ghostscript';

export interface FormatSpec {
  /** Canonical, URL-safe identifier — also the output file extension. */
  id: string;
  label: string;
  aliases: readonly string[];
  mime: string;
  category: Category;
  description: string;
  canInput: boolean;
  canOutput: boolean;
  /** True for formats that carry an alpha channel. */
  supportsAlpha?: boolean;
}

export interface ConversionRoute {
  from: string;
  to: string;
  engine:
    | 'image'
    | 'media'
    | 'document'
    | 'spreadsheet'
    | 'office'
    | 'pdf-render'
    | 'pdf-text'
    | 'archive';
  requires?: Requirement;
}

// ---------------------------------------------------------------------------
// Conversion options (validated server-side by `optionsSchemaFor`)
// ---------------------------------------------------------------------------

export type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

export interface ImageOptions {
  /** 1–100, mapped to each encoder's quality scale. */
  quality?: number;
  width?: number;
  height?: number;
  fit?: ResizeFit;
  /**
   * Crop rectangle in source pixels, applied before any resize. All four
   * values must be present for the crop to take effect.
   */
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  /** Strip EXIF/IPTC/XMP metadata. Defaults to true for privacy. */
  stripMetadata?: boolean;
  /** Flatten transparency onto this colour when the target lacks alpha. */
  background?: string;
  rotate?: 0 | 90 | 180 | 270;
  grayscale?: boolean;
}

export interface MediaOptions {
  /** Audio bitrate in kbps. */
  audioBitrate?: number;
  /** Video bitrate in kbps; omitted for CRF-based encoding. */
  videoBitrate?: number;
  /** Target height in pixels; width is derived from the source aspect ratio. */
  resolution?: 240 | 360 | 480 | 720 | 1080 | 1440 | 2160;
  fps?: number;
  /** Constant Rate Factor, 0–51. Lower is higher quality. */
  crf?: number;
  /** Drop the video stream (audio extraction). */
  audioOnly?: boolean;
  /** Trim start offset in seconds. */
  startSeconds?: number;
  /** Trim duration in seconds. */
  durationSeconds?: number;
  sampleRate?: 16000 | 22050 | 24000 | 32000 | 44100 | 48000;
  channels?: 1 | 2;
  normalizeLoudness?: boolean;
}

export interface DocumentOptions {
  /** Page size for generated PDFs. */
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  marginMm?: number;
  /** Sheet name or index for spreadsheet extraction. */
  sheet?: string;
  /** Delimiter used when reading or writing CSV. */
  delimiter?: ',' | ';' | '\t' | '|';
  /** Rasterisation density for PDF page rendering. */
  dpi?: number;
  /** Page selection for PDF rendering: `all`, `1`, or `2-5`. */
  pages?: string;
}

export interface ArchiveOptions {
  /** 0 (store) – 9 (maximum). */
  compressionLevel?: number;
  /** Opens an encrypted source archive, or protects the archive being made. */
  password?: string;
  /**
   * `aes256` is real encryption; `zipcrypto` is the legacy scheme, kept only
   * because some built-in system unzippers cannot open AES archives.
   */
  encryption?: 'aes256' | 'zipcrypto';
}

export type ConversionOptions = ImageOptions &
  MediaOptions &
  DocumentOptions &
  ArchiveOptions;

// ---------------------------------------------------------------------------
// Engine contract
// ---------------------------------------------------------------------------

export interface ConversionContext {
  /** Absolute path to the source file on local disk. */
  inputPath: string;
  /** Absolute path the engine must write its result to. */
  outputPath: string;
  /** The name the user uploaded, e.g. `report.json.gz`. */
  inputName: string;
  /**
   * Additional sources, in order, for routes that fold several files into one
   * output — images to a single PDF today. `inputPath` is always the first, so
   * an engine that ignores this still behaves correctly on a single file.
   */
  extraInputPaths?: readonly string[];
  /** Uploaded names of `extraInputPaths`, same order. */
  extraInputNames?: readonly string[];
  sourceFormat: string;
  targetFormat: string;
  options: ConversionOptions;
  /** Reports 0–100 completion. Called at most a few times per second. */
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export interface ConversionOutcome {
  outputPath: string;
  mime: string;
  /** Optional engine-reported details surfaced in the job record. */
  detail?: string;
}

export interface ConversionEngine {
  readonly id: ConversionRoute['engine'];
  run(context: ConversionContext): Promise<ConversionOutcome>;
}

/** Failure with a message that is safe to show to the end user. */
export class ConversionError extends Error {
  readonly userFacing = true;
  readonly retryable: boolean;

  constructor(
    message: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ConversionError';
    this.retryable = options?.retryable ?? false;
  }
}
