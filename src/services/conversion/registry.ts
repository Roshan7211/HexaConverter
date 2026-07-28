import {
  type Category,
  type ConversionRoute,
  type FormatSpec,
} from '@/types/conversion';

/**
 * The format catalogue and conversion matrix.
 *
 * Every supported route is declared here and nowhere else: the picker UI, the
 * SEO landing pages, the public `/api/formats` document and the server-side
 * job validator all read from this module, so an unsupported combination
 * cannot be requested through any surface.
 */

function spec(
  id: string,
  label: string,
  mime: string,
  category: Category,
  description: string,
  options: Partial<
    Pick<FormatSpec, 'aliases' | 'canInput' | 'canOutput' | 'supportsAlpha'>
  > = {},
): FormatSpec {
  return {
    id,
    label,
    mime,
    category,
    description,
    aliases: options.aliases ?? [],
    canInput: options.canInput ?? true,
    canOutput: options.canOutput ?? true,
    supportsAlpha: options.supportsAlpha ?? false,
  };
}

const FORMAT_LIST: readonly FormatSpec[] = [
  // --- Images -------------------------------------------------------------
  spec(
    'jpg',
    'JPEG',
    'image/jpeg',
    'image',
    'Universally supported lossy photo format.',
    {
      aliases: ['jpeg', 'jpe'],
    },
  ),
  spec(
    'png',
    'PNG',
    'image/png',
    'image',
    'Lossless raster format with alpha transparency.',
    {
      supportsAlpha: true,
    },
  ),
  spec(
    'webp',
    'WebP',
    'image/webp',
    'image',
    'Modern web format, roughly 30% smaller than JPEG.',
    {
      supportsAlpha: true,
    },
  ),
  spec(
    'avif',
    'AVIF',
    'image/avif',
    'image',
    'Next-generation format with the best compression ratio.',
    {
      supportsAlpha: true,
    },
  ),
  spec(
    'tiff',
    'TIFF',
    'image/tiff',
    'image',
    'High-fidelity format used in print and archival work.',
    {
      aliases: ['tif'],
      supportsAlpha: true,
    },
  ),
  spec(
    'gif',
    'GIF',
    'image/gif',
    'image',
    'Indexed-colour format with animation support.',
    {
      supportsAlpha: true,
    },
  ),
  spec(
    'svg',
    'SVG',
    'image/svg+xml',
    'image',
    'Resolution-independent vector graphics.',
    {
      canOutput: false,
    },
  ),
  spec('bmp', 'BMP', 'image/bmp', 'image', 'Uncompressed Windows bitmap.', {
    supportsAlpha: true,
  }),
  spec(
    'heic',
    'HEIC',
    'image/heic',
    'image',
    'High-efficiency photo format, used by iPhone cameras.',
    {
      aliases: ['heif'],
      // Encoding HEIC needs a licensed HEVC encoder, which is not shipped.
      canOutput: false,
    },
  ),

  // --- Documents ----------------------------------------------------------
  spec(
    'pdf',
    'PDF',
    'application/pdf',
    'document',
    'Fixed-layout format for sharing and printing.',
  ),
  spec(
    'docx',
    'Word (DOCX)',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'document',
    'Office Open XML word processing document.',
  ),
  spec(
    'doc',
    'Word 97–2003 (DOC)',
    'application/msword',
    'document',
    'Legacy binary Word document.',
    {
      canOutput: false,
    },
  ),
  spec(
    'odt',
    'OpenDocument Text',
    'application/vnd.oasis.opendocument.text',
    'document',
    'ISO-standard open document format.',
  ),
  spec(
    'rtf',
    'Rich Text',
    'application/rtf',
    'document',
    'Portable formatted text interchange format.',
  ),
  spec(
    'txt',
    'Plain Text',
    'text/plain',
    'document',
    'Unformatted UTF-8 text.',
  ),
  spec(
    'md',
    'Markdown',
    'text/markdown',
    'document',
    'Lightweight plain-text markup.',
    {
      aliases: ['markdown'],
      canOutput: false,
    },
  ),
  spec(
    'html',
    'HTML',
    'text/html',
    'document',
    'Hypertext markup for the web.',
    { aliases: ['htm'] },
  ),

  // --- Spreadsheets & data -----------------------------------------------
  spec(
    'xlsx',
    'Excel (XLSX)',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'document',
    'Office Open XML workbook.',
  ),
  spec(
    'xls',
    'Excel 97–2003 (XLS)',
    'application/vnd.ms-excel',
    'document',
    'Legacy binary workbook.',
    {
      canOutput: false,
    },
  ),
  spec(
    'ods',
    'OpenDocument Sheet',
    'application/vnd.oasis.opendocument.spreadsheet',
    'document',
    'Open standard spreadsheet format.',
  ),
  spec(
    'csv',
    'CSV',
    'text/csv',
    'document',
    'Delimiter-separated tabular data.',
  ),
  spec(
    'json',
    'JSON',
    'application/json',
    'document',
    'Structured data interchange format.',
  ),

  // --- Presentations ------------------------------------------------------
  spec(
    'pptx',
    'PowerPoint (PPTX)',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'document',
    'Office Open XML presentation.',
  ),
  spec(
    'ppt',
    'PowerPoint 97–2003',
    'application/vnd.ms-powerpoint',
    'document',
    'Legacy binary presentation.',
    {
      canOutput: false,
    },
  ),
  spec(
    'odp',
    'OpenDocument Slides',
    'application/vnd.oasis.opendocument.presentation',
    'document',
    'Open standard presentation format.',
  ),

  // --- Audio --------------------------------------------------------------
  spec(
    'mp3',
    'MP3',
    'audio/mpeg',
    'audio',
    'The most widely compatible lossy audio format.',
  ),
  spec(
    'wav',
    'WAV',
    'audio/wav',
    'audio',
    'Uncompressed PCM audio for editing and mastering.',
  ),
  spec(
    'flac',
    'FLAC',
    'audio/flac',
    'audio',
    'Lossless compression with roughly half the size of WAV.',
  ),
  spec(
    'ogg',
    'OGG Vorbis',
    'audio/ogg',
    'audio',
    'Royalty-free lossy format for streaming.',
    {
      aliases: ['oga'],
    },
  ),
  spec(
    'opus',
    'Opus',
    'audio/opus',
    'audio',
    'Low-latency codec with excellent quality at low bitrates.',
  ),
  spec(
    'aac',
    'AAC',
    'audio/aac',
    'audio',
    'Efficient successor to MP3 used in broadcast and streaming.',
  ),
  spec('m4a', 'M4A', 'audio/mp4', 'audio', 'AAC audio in an MP4 container.'),

  // --- Video --------------------------------------------------------------
  spec(
    'mp4',
    'MP4',
    'video/mp4',
    'video',
    'H.264/AAC video that plays on virtually any device.',
  ),
  spec(
    'webm',
    'WebM',
    'video/webm',
    'video',
    'Open, royalty-free format optimised for the web.',
  ),
  spec(
    'mkv',
    'Matroska (MKV)',
    'video/x-matroska',
    'video',
    'Flexible container for high-quality video.',
  ),
  spec(
    'mov',
    'QuickTime (MOV)',
    'video/quicktime',
    'video',
    'Editing-friendly container from the Apple ecosystem.',
  ),
  spec(
    'avi',
    'AVI',
    'video/x-msvideo',
    'video',
    'Legacy container with broad desktop support.',
  ),

  // --- Archives -----------------------------------------------------------
  spec(
    'zip',
    'ZIP',
    'application/zip',
    'archive',
    'The default archive format across all platforms.',
  ),
  spec(
    'tar',
    'TAR',
    'application/x-tar',
    'archive',
    'Uncompressed Unix archive stream.',
  ),
  spec(
    'tgz',
    'TAR.GZ',
    'application/gzip',
    'archive',
    'Gzip-compressed TAR archive.',
    {
      aliases: ['tar.gz', 'tar.gzip'],
    },
  ),
  spec(
    '7z',
    '7Z',
    'application/x-7z-compressed',
    'archive',
    'High-ratio archive from the 7-Zip project.',
  ),
  spec(
    'rar',
    'RAR',
    'application/vnd.rar',
    'archive',
    'Proprietary archive format. Reading is supported; only WinRAR can create one.',
    {
      // RAR compression is proprietary — no free encoder exists, so this
      // format can be opened but never produced.
      canOutput: false,
    },
  ),
  spec(
    'gz',
    'GZIP',
    'application/gzip',
    'archive',
    'Single-file gzip stream, as produced by `gzip`.',
    {
      aliases: ['gzip'],
    },
  ),
];

export const FORMATS: Readonly<Record<string, FormatSpec>> = Object.freeze(
  Object.fromEntries(FORMAT_LIST.map((format) => [format.id, format])),
);

/** Alias (and extension) lookup, e.g. `jpeg` → `jpg`, `tar.gz` → `tgz`. */
const ALIAS_INDEX: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    FORMAT_LIST.flatMap((format) => [
      [format.id, format.id],
      ...format.aliases.map((alias) => [alias, format.id] as const),
    ]),
  ),
);

/** Resolves a user-supplied extension or alias to a canonical format id. */
export function resolveFormatId(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/^\./, '');
  return ALIAS_INDEX[normalized] ?? null;
}

export function getFormat(id: string): FormatSpec | null {
  return FORMATS[id] ?? null;
}

// ---------------------------------------------------------------------------
// Conversion matrix
// ---------------------------------------------------------------------------

const RASTER_IMAGES = [
  'jpg',
  'png',
  'webp',
  'avif',
  'tiff',
  'gif',
  'bmp',
] as const;
const IMAGE_SOURCES = [...RASTER_IMAGES, 'svg', 'heic'] as const;

const WORD_FORMATS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'html'] as const;
const WORD_TARGETS = ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html'] as const;
const SHEET_FORMATS = ['xlsx', 'xls', 'ods', 'csv'] as const;
const SHEET_TARGETS = ['pdf', 'xlsx', 'ods', 'csv'] as const;
const SLIDE_FORMATS = ['pptx', 'ppt', 'odp'] as const;
const SLIDE_TARGETS = ['pdf', 'pptx', 'odp'] as const;

const AUDIO_FORMATS = [
  'mp3',
  'wav',
  'flac',
  'ogg',
  'opus',
  'aac',
  'm4a',
] as const;
const VIDEO_FORMATS = ['mp4', 'webm', 'mkv', 'mov', 'avi'] as const;
const ARCHIVE_FORMATS = ['zip', 'tar', 'tgz', '7z'] as const;
/** Openable but not creatable: RAR has no free encoder, GZIP holds one file. */
const ARCHIVE_SOURCE_ONLY = ['rar', 'gz'] as const;

function build(): ConversionRoute[] {
  const routes: ConversionRoute[] = [];
  const seen = new Set<string>();

  const add = (
    from: string,
    to: string,
    engine: ConversionRoute['engine'],
    requires?: ConversionRoute['requires'],
    { allowIdentity = false } = {},
  ) => {
    if (from === to && !allowIdentity) return;
    const key = `${from}>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push(
      requires ? { from, to, engine, requires } : { from, to, engine },
    );
  };

  // Images — raster transcoding and vector rasterisation.
  for (const from of IMAGE_SOURCES) {
    for (const to of RASTER_IMAGES) add(from, to, 'image');
    // Every image can be wrapped in a single-page PDF.
    add(from, 'pdf', 'document');
  }

  // Same-format image routes. Editing operations — crop, resize, rotate and
  // re-compression — are just as useful without changing container, and
  // refusing "PNG to PNG" would force a pointless format change on anyone who
  // only wants to crop. These are excluded from the generated landing pages,
  // which exist to answer "how do I convert X to Y".
  for (const format of RASTER_IMAGES) {
    add(format, format, 'image', undefined, { allowIdentity: true });
  }

  // Native document handling that needs no external binary.
  add('md', 'html', 'document');
  add('md', 'txt', 'document');
  add('html', 'txt', 'document');
  add('txt', 'pdf', 'document');
  add('txt', 'html', 'document');

  // Spreadsheets and structured data handled in-process.
  add('csv', 'xlsx', 'spreadsheet');
  add('csv', 'json', 'spreadsheet');
  add('xlsx', 'csv', 'spreadsheet');
  add('xlsx', 'json', 'spreadsheet');
  add('json', 'csv', 'spreadsheet');
  add('json', 'xlsx', 'spreadsheet');

  // Office suite conversions via headless LibreOffice.
  for (const from of WORD_FORMATS) {
    for (const to of WORD_TARGETS) add(from, to, 'office', 'libreoffice');
  }
  for (const from of SHEET_FORMATS) {
    for (const to of SHEET_TARGETS) add(from, to, 'office', 'libreoffice');
  }
  for (const from of SLIDE_FORMATS) {
    for (const to of SLIDE_TARGETS) add(from, to, 'office', 'libreoffice');
  }

  // PDF rasterisation and text extraction. No requirement is declared: the
  // engine uses Poppler when the host has it and falls back to PDF.js with a
  // prebuilt canvas when it does not, so the route is always satisfiable.
  // Declaring `poppler` here would hide these routes on every deployment that
  // cannot install system packages, which is exactly where the fallback runs.
  for (const to of ['jpg', 'png', 'tiff'] as const) {
    add('pdf', to, 'pdf-render');
  }
  add('pdf', 'txt', 'pdf-render');

  // PDF to Word, also pure JavaScript.
  add('pdf', 'docx', 'pdf-text');

  // Audio transcoding.
  for (const from of AUDIO_FORMATS) {
    for (const to of AUDIO_FORMATS) add(from, to, 'media');
  }

  // Video transcoding, animation export and audio extraction.
  for (const from of VIDEO_FORMATS) {
    for (const to of VIDEO_FORMATS) add(from, to, 'media');
    add(from, 'gif', 'media');
    for (const to of AUDIO_FORMATS) add(from, to, 'media');
  }
  add('gif', 'mp4', 'media');
  add('gif', 'webm', 'media');

  // Same-format media routes, for the same reason as the image ones above:
  // trimming, compressing or changing the resolution of an MP4 should not
  // force the user to leave MP4. Also excluded from the landing pages.
  for (const format of [...VIDEO_FORMATS, ...AUDIO_FORMATS]) {
    add(format, format, 'media', undefined, { allowIdentity: true });
  }

  // Archive repackaging.
  for (const from of ARCHIVE_FORMATS) {
    for (const to of ARCHIVE_FORMATS) add(from, to, 'archive');
  }
  // RAR and GZIP can be opened and repacked into any creatable archive.
  for (const from of ARCHIVE_SOURCE_ONLY) {
    for (const to of ARCHIVE_FORMATS) add(from, to, 'archive');
  }

  return routes;
}

export const CONVERSION_ROUTES: readonly ConversionRoute[] =
  Object.freeze(build());

const ROUTE_INDEX: Readonly<Record<string, ConversionRoute>> = Object.freeze(
  Object.fromEntries(
    CONVERSION_ROUTES.map((route) => [`${route.from}>${route.to}`, route]),
  ),
);

export function findRoute(from: string, to: string): ConversionRoute | null {
  return ROUTE_INDEX[`${from}>${to}`] ?? null;
}

/** All formats a given source can be converted into, sorted by label. */
export function targetsFor(from: string): FormatSpec[] {
  return CONVERSION_ROUTES.filter((route) => route.from === from)
    .map((route) => FORMATS[route.to])
    .filter((format): format is FormatSpec => Boolean(format))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** All formats accepted as input for a category. */
export function inputFormatsFor(category: Category): FormatSpec[] {
  return FORMAT_LIST.filter(
    (format) =>
      format.category === category &&
      format.canInput &&
      CONVERSION_ROUTES.some((route) => route.from === format.id),
  );
}

export function formatsByCategory(category: Category): FormatSpec[] {
  return FORMAT_LIST.filter((format) => format.category === category);
}

/** Input extensions accepted by the upload endpoint, including aliases. */
export const ACCEPTED_INPUT_EXTENSIONS: readonly string[] = Object.freeze(
  Array.from(
    new Set(
      FORMAT_LIST.filter((format) =>
        CONVERSION_ROUTES.some((route) => route.from === format.id),
      ).flatMap((format) => [format.id, ...format.aliases]),
    ),
  ).sort(),
);

/** `accept` attribute value for file inputs, scoped to a category. */
export function acceptAttributeFor(category: Category | 'all'): string {
  const formats =
    category === 'all'
      ? FORMAT_LIST.filter((f) => f.canInput)
      : inputFormatsFor(category);

  return Array.from(
    new Set(
      formats.flatMap((format) => [
        format.mime,
        `.${format.id}`,
        ...format.aliases.map((alias) => `.${alias}`),
      ]),
    ),
  ).join(',');
}

export const CATEGORY_META: Readonly<
  Record<Category, { label: string; blurb: string; headline: string }>
> = Object.freeze({
  image: {
    label: 'Images',
    headline: 'Convert images without losing quality',
    blurb:
      'Transcode between JPEG, PNG, WebP, AVIF, TIFF and GIF, resize in the same pass and strip location metadata automatically.',
  },
  document: {
    label: 'Documents',
    headline: 'Convert documents and spreadsheets',
    blurb:
      'Move between PDF, Word, Excel, PowerPoint, OpenDocument, CSV and JSON with layout and formulas preserved.',
  },
  audio: {
    label: 'Audio',
    headline: 'Convert audio files',
    blurb:
      'Re-encode MP3, WAV, FLAC, OGG, Opus, AAC and M4A, trim to the section you need, and set bitrate, sample rate and loudness.',
  },
  video: {
    label: 'Video',
    headline: 'Convert and compress video',
    blurb:
      'Transcode MP4, WebM, MKV, MOV and AVI, trim, compress, change resolution or frame rate, extract the audio track or export an animated GIF.',
  },
  archive: {
    label: 'Archives',
    headline: 'Repackage archives',
    blurb:
      'Convert between ZIP, TAR and TAR.GZ with configurable compression, and inspect contents before you download.',
  },
});

/** Curated high-intent routes featured on the home page. */
export const FEATURED_ROUTES: readonly string[] = Object.freeze([
  'png-to-jpg',
  'jpg-to-png',
  'png-to-webp',
  'jpg-to-webp',
  'webp-to-png',
  'pdf-to-jpg',
  'docx-to-pdf',
  'xlsx-to-csv',
  'csv-to-xlsx',
  'mp4-to-mp3',
  'mov-to-mp4',
  'webm-to-mp4',
  'wav-to-mp3',
  'flac-to-mp3',
  'mp4-to-gif',
  'zip-to-tgz',
]);

export function routeSlug(route: Pick<ConversionRoute, 'from' | 'to'>): string {
  return `${route.from}-to-${route.to}`;
}

/**
 * Routes that warrant a landing page: identity routes are real conversions but
 * nobody searches for "convert PNG to PNG".
 */
export const PUBLISHED_ROUTES: readonly ConversionRoute[] = Object.freeze(
  CONVERSION_ROUTES.filter((route) => route.from !== route.to),
);

export function parseRouteSlug(slug: string): ConversionRoute | null {
  const match = /^([a-z0-9]+)-to-([a-z0-9]+)$/.exec(slug.toLowerCase());
  if (!match) return null;
  const from = resolveFormatId(match[1]!);
  const to = resolveFormatId(match[2]!);
  if (!from || !to) return null;
  return findRoute(from, to);
}

/** Total number of advertised conversions — used in marketing copy. */
export const TOTAL_ROUTES = CONVERSION_ROUTES.length;
