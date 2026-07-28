/**
 * Container sniffing from magic bytes.
 *
 * User-supplied MIME types and extensions are advisory only — every upload is
 * verified against the byte signature of its container before it reaches a
 * conversion engine. Several formats share one container (all OOXML and
 * OpenDocument files are ZIP archives; MP4/M4A/MOV share the ISO-BMFF `ftyp`
 * box), so sniffing resolves to a *container family* which is then checked
 * against the declared extension.
 */

export type ContainerFamily =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'tiff'
  | 'iso-bmff-image'
  | 'ico'
  | 'svg'
  | 'pdf'
  | 'zip'
  | 'rar'
  | '7z'
  | 'gzip'
  | 'bzip2'
  | 'xz'
  | 'tar'
  | 'mp3'
  | 'wav'
  | 'flac'
  | 'ogg'
  | 'aac'
  | 'iso-bmff-av'
  | 'matroska'
  | 'avi'
  | 'ole-compound'
  | 'rtf'
  | 'text';

/** Extensions that legitimately resolve to each container family. */
const FAMILY_EXTENSIONS: Record<ContainerFamily, readonly string[]> = {
  jpeg: ['jpg', 'jpeg', 'jpe'],
  png: ['png'],
  gif: ['gif'],
  webp: ['webp'],
  bmp: ['bmp'],
  tiff: ['tif', 'tiff'],
  'iso-bmff-image': ['avif', 'heic', 'heif'],
  ico: ['ico'],
  svg: ['svg'],
  pdf: ['pdf'],
  zip: ['zip', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub'],
  rar: ['rar'],
  '7z': ['7z'],
  gzip: ['gz', 'tgz'],
  bzip2: ['bz2'],
  xz: ['xz'],
  tar: ['tar'],
  mp3: ['mp3'],
  wav: ['wav'],
  flac: ['flac'],
  ogg: ['ogg', 'oga', 'ogv', 'opus'],
  aac: ['aac'],
  'iso-bmff-av': ['mp4', 'm4a', 'm4v', 'mov', '3gp'],
  matroska: ['mkv', 'webm'],
  avi: ['avi'],
  'ole-compound': ['doc', 'xls', 'ppt'],
  rtf: ['rtf'],
  text: ['txt', 'csv', 'tsv', 'md', 'markdown', 'html', 'htm', 'json', 'xml'],
};

/** Bytes needed for a reliable verdict (TAR's `ustar` marker sits at 257). */
export const SNIFF_LENGTH = 512;

function startsWith(buffer: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function asciiAt(buffer: Uint8Array, offset: number, length: number): string {
  if (buffer.length < offset + length) return '';
  return String.fromCharCode(...buffer.subarray(offset, offset + length));
}

/** ISO Base Media brands that are still images rather than audio/video. */
const IMAGE_BRANDS = new Set([
  'avif',
  'avis',
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'mif1',
  'msf1',
]);

function looksLikeUtf8Text(buffer: Uint8Array): boolean {
  // Reject anything containing NUL or an excess of control characters — those
  // indicate a binary payload masquerading as text.
  let control = 0;
  for (const byte of buffer) {
    if (byte === 0x00) return false;
    const isAllowedControl =
      byte === 0x09 || byte === 0x0a || byte === 0x0d || byte >= 0x20;
    if (!isAllowedControl) control += 1;
  }
  return control / Math.max(buffer.length, 1) < 0.05;
}

function isMp3FrameHeader(buffer: Uint8Array): boolean {
  const first = buffer[0];
  const second = buffer[1];
  if (first === undefined || second === undefined) return false;
  // 11-bit frame sync followed by a non-reserved MPEG version + layer.
  return first === 0xff && (second & 0xe0) === 0xe0 && (second & 0x18) !== 0x08;
}

/**
 * ADTS AAC shares the 0xFF sync byte with MPEG audio, so it has to be tested
 * first or every `.aac` file is mistaken for an MP3 and rejected as a mismatch.
 * The discriminator is the layer field: it is always 00 for ADTS and never 00
 * for MPEG audio.
 */
function isAdtsAacHeader(buffer: Uint8Array): boolean {
  const first = buffer[0];
  const second = buffer[1];
  if (first === undefined || second === undefined) return false;
  return first === 0xff && (second & 0xf6) === 0xf0;
}

/**
 * Detects the container family of a buffer. Returns `null` when the bytes match
 * no supported container.
 */
export function sniffContainer(input: Uint8Array): ContainerFamily | null {
  const buffer = input.subarray(0, SNIFF_LENGTH);
  if (buffer.length < 4) return null;

  // --- Images -------------------------------------------------------------
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (
    asciiAt(buffer, 0, 6) === 'GIF87a' ||
    asciiAt(buffer, 0, 6) === 'GIF89a'
  ) {
    return 'gif';
  }
  if (startsWith(buffer, [0x42, 0x4d])) return 'bmp';
  if (
    startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return 'tiff';
  }
  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) return 'ico';

  // --- RIFF containers ----------------------------------------------------
  if (asciiAt(buffer, 0, 4) === 'RIFF') {
    const form = asciiAt(buffer, 8, 4);
    if (form === 'WEBP') return 'webp';
    if (form === 'WAVE') return 'wav';
    if (form === 'AVI ') return 'avi';
    return null;
  }

  // --- ISO Base Media (MP4 family) ---------------------------------------
  if (asciiAt(buffer, 4, 4) === 'ftyp') {
    const brand = asciiAt(buffer, 8, 4).trim().toLowerCase();
    return IMAGE_BRANDS.has(brand) ? 'iso-bmff-image' : 'iso-bmff-av';
  }

  // --- Documents / archives ----------------------------------------------
  if (asciiAt(buffer, 0, 5) === '%PDF-') return 'pdf';
  if (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  ) {
    return 'zip';
  }
  if (startsWith(buffer, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return 'rar';
  if (startsWith(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z';
  if (startsWith(buffer, [0x1f, 0x8b])) return 'gzip';
  if (asciiAt(buffer, 0, 3) === 'BZh') return 'bzip2';
  if (startsWith(buffer, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return 'xz';
  if (asciiAt(buffer, 257, 5) === 'ustar') return 'tar';
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'ole-compound';
  }
  if (asciiAt(buffer, 0, 5) === '{\\rtf') return 'rtf';

  // --- Audio / video ------------------------------------------------------
  // ADTS is checked ahead of MP3: both start 0xFF and only the layer bits
  // separate them.
  if (isAdtsAacHeader(buffer)) return 'aac';
  if (asciiAt(buffer, 0, 3) === 'ID3' || isMp3FrameHeader(buffer)) return 'mp3';
  if (asciiAt(buffer, 0, 4) === 'fLaC') return 'flac';
  if (asciiAt(buffer, 0, 4) === 'OggS') return 'ogg';
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'matroska';

  // --- Text-based ---------------------------------------------------------
  if (looksLikeUtf8Text(buffer)) {
    const head = asciiAt(buffer, 0, Math.min(buffer.length, 256))
      .trimStart()
      .toLowerCase();
    if (
      head.startsWith('<svg') ||
      (head.startsWith('<?xml') && head.includes('<svg'))
    ) {
      return 'svg';
    }
    return 'text';
  }

  return null;
}

/**
 * Verifies that sniffed bytes are consistent with the declared extension.
 * SVG and XML both surface as text-like containers, so the text family is
 * accepted for either.
 */
export function isExtensionConsistent(
  family: ContainerFamily,
  extension: string,
): boolean {
  const ext = extension.toLowerCase();
  if (FAMILY_EXTENSIONS[family].includes(ext)) return true;

  // A `.svg` upload may be sniffed as generic text when the root element is
  // preceded by comments or a DOCTYPE; and XML-ish text may be `.svg`.
  if (family === 'text' && ext === 'svg') return true;
  if (family === 'svg' && (ext === 'xml' || ext === 'html')) return true;

  // `.tgz`/`.gz` wrap a TAR stream that only becomes visible after inflation.
  if (family === 'gzip' && (ext === 'tar' || ext === 'tgz')) return true;

  return false;
}

/** Extensions this platform will accept as input, derived from the families. */
export const ACCEPTED_EXTENSIONS: readonly string[] = Object.freeze(
  Array.from(new Set(Object.values(FAMILY_EXTENSIONS).flat())).sort(),
);
