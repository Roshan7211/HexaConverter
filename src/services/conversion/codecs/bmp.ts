/**
 * BMP codec.
 *
 * libvips — and therefore sharp — has no BMP support in its prebuilt binaries,
 * so this is a self-contained reader and writer that converts to and from the
 * raw RGBA buffers sharp accepts. Kept dependency-free and pure so it can be
 * unit tested directly.
 *
 * Reads the variants that occur in practice: 1, 4, 8, 16, 24 and 32 bits per
 * pixel, `BI_RGB` and `BI_BITFIELDS`, palette or direct colour, stored either
 * bottom-up (the default) or top-down (negative height).
 *
 * Run-length encoded BMPs (`BI_RLE8` / `BI_RLE4`) are rejected with a clear
 * message rather than decoded incorrectly — they are vanishingly rare outside
 * of legacy Windows assets.
 */

export interface RawImage {
  width: number;
  height: number;
  /** Always 4: RGBA, non-premultiplied. */
  channels: 4;
  data: Buffer;
}

export class BmpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BmpError';
  }
}

const FILE_HEADER_BYTES = 14;

/** Guards against a header claiming dimensions that would exhaust memory. */
const MAX_PIXELS = 100_000_000;

// --- compression methods ----------------------------------------------------
const BI_RGB = 0;
const BI_RLE8 = 1;
const BI_RLE4 = 2;
const BI_BITFIELDS = 3;

/** Number of trailing zero bits, used to shift a masked channel down. */
function trailingZeros(mask: number): number {
  if (mask === 0) return 0;
  let count = 0;
  while ((mask & (1 << count)) === 0) count += 1;
  return count;
}

/** Scales an n-bit channel value up to a full 8-bit range. */
function scaleChannel(value: number, bits: number): number {
  if (bits === 8) return value;
  if (bits === 0) return 0;
  const max = (1 << bits) - 1;
  return Math.round((value / max) * 255);
}

export function decodeBmp(buffer: Buffer): RawImage {
  if (buffer.length < 2 || buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
    throw new BmpError('The file is not a BMP: the "BM" signature is missing.');
  }
  if (buffer.length < FILE_HEADER_BYTES + 12) {
    throw new BmpError(
      'The BMP is truncated: it is too small to contain a header.',
    );
  }

  const pixelOffset = buffer.readUInt32LE(10);
  const headerSize = buffer.readUInt32LE(14);

  if (headerSize < 12) {
    throw new BmpError('The BMP header is malformed.');
  }

  // BITMAPCOREHEADER (12 bytes) uses 16-bit dimensions; everything later uses
  // 32-bit signed values where a negative height means the rows are top-down.
  const isCore = headerSize === 12;

  const rawWidth = isCore ? buffer.readInt16LE(18) : buffer.readInt32LE(18);
  const rawHeight = isCore ? buffer.readInt16LE(20) : buffer.readInt32LE(22);
  const bitCount = isCore ? buffer.readUInt16LE(24) : buffer.readUInt16LE(28);
  const compression = isCore ? BI_RGB : buffer.readUInt32LE(30);

  const width = Math.abs(rawWidth);
  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;

  if (width === 0 || height === 0) {
    throw new BmpError('The BMP reports zero width or height.');
  }
  if (width * height > MAX_PIXELS) {
    throw new BmpError('The BMP is too large to decode safely.');
  }
  if (compression === BI_RLE8 || compression === BI_RLE4) {
    throw new BmpError(
      'Run-length encoded BMP files are not supported. Re-save the image as an uncompressed BMP.',
    );
  }
  if (![1, 4, 8, 16, 24, 32].includes(bitCount)) {
    throw new BmpError(
      `Unsupported BMP colour depth: ${bitCount} bits per pixel.`,
    );
  }

  // --- channel masks --------------------------------------------------------
  let redMask = 0;
  let greenMask = 0;
  let blueMask = 0;
  let alphaMask = 0;

  if (compression === BI_BITFIELDS) {
    if (headerSize >= 52) {
      redMask = buffer.readUInt32LE(54);
      greenMask = buffer.readUInt32LE(58);
      blueMask = buffer.readUInt32LE(62);
      alphaMask = headerSize >= 56 ? buffer.readUInt32LE(66) : 0;
    } else {
      // BITMAPINFOHEADER + masks stored immediately after the header.
      redMask = buffer.readUInt32LE(FILE_HEADER_BYTES + headerSize);
      greenMask = buffer.readUInt32LE(FILE_HEADER_BYTES + headerSize + 4);
      blueMask = buffer.readUInt32LE(FILE_HEADER_BYTES + headerSize + 8);
    }
  } else if (bitCount === 16) {
    // Default 16-bit layout is X1R5G5B5.
    redMask = 0x7c00;
    greenMask = 0x03e0;
    blueMask = 0x001f;
  } else if (bitCount === 32) {
    redMask = 0x00ff0000;
    greenMask = 0x0000ff00;
    blueMask = 0x000000ff;
  }

  // --- palette --------------------------------------------------------------
  let palette: Buffer | null = null;
  if (bitCount <= 8) {
    const entrySize = isCore ? 3 : 4;
    const declared = isCore ? 0 : buffer.readUInt32LE(46);
    const count = declared === 0 ? 1 << bitCount : declared;
    const start = FILE_HEADER_BYTES + headerSize;

    palette = Buffer.alloc(count * 4);
    for (let index = 0; index < count; index += 1) {
      const at = start + index * entrySize;
      if (at + 2 >= buffer.length) break;
      palette[index * 4] = buffer[at + 2]!; // R (stored BGR)
      palette[index * 4 + 1] = buffer[at + 1]!;
      palette[index * 4 + 2] = buffer[at]!;
      palette[index * 4 + 3] = 255;
    }
  }

  // --- pixel data -----------------------------------------------------------
  // Rows are padded to a 4-byte boundary.
  const rowSize = Math.floor((bitCount * width + 31) / 32) * 4;
  const dataStart =
    pixelOffset > 0 ? pixelOffset : FILE_HEADER_BYTES + headerSize;

  if (dataStart + rowSize * height > buffer.length) {
    throw new BmpError(
      'The BMP is truncated: the pixel data is shorter than its header declares.',
    );
  }

  const out = Buffer.alloc(width * height * 4);

  const redShift = trailingZeros(redMask);
  const greenShift = trailingZeros(greenMask);
  const blueShift = trailingZeros(blueMask);
  const alphaShift = trailingZeros(alphaMask);
  const redBits = popCount(redMask);
  const greenBits = popCount(greenMask);
  const blueBits = popCount(blueMask);
  const alphaBits = popCount(alphaMask);

  for (let y = 0; y < height; y += 1) {
    // Bottom-up rows are stored last-first.
    const sourceRow = topDown ? y : height - 1 - y;
    const rowStart = dataStart + sourceRow * rowSize;

    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;

      if (bitCount === 24) {
        const at = rowStart + x * 3;
        out[target] = buffer[at + 2]!;
        out[target + 1] = buffer[at + 1]!;
        out[target + 2] = buffer[at]!;
        out[target + 3] = 255;
        continue;
      }

      if (bitCount === 32) {
        const value = buffer.readUInt32LE(rowStart + x * 4);
        out[target] = scaleChannel((value & redMask) >>> redShift, redBits);
        out[target + 1] = scaleChannel(
          (value & greenMask) >>> greenShift,
          greenBits,
        );
        out[target + 2] = scaleChannel(
          (value & blueMask) >>> blueShift,
          blueBits,
        );
        // A zero alpha mask means the fourth byte is padding, not transparency.
        out[target + 3] = alphaMask
          ? scaleChannel((value & alphaMask) >>> alphaShift, alphaBits)
          : 255;
        continue;
      }

      if (bitCount === 16) {
        const value = buffer.readUInt16LE(rowStart + x * 2);
        out[target] = scaleChannel((value & redMask) >>> redShift, redBits);
        out[target + 1] = scaleChannel(
          (value & greenMask) >>> greenShift,
          greenBits,
        );
        out[target + 2] = scaleChannel(
          (value & blueMask) >>> blueShift,
          blueBits,
        );
        out[target + 3] = alphaMask
          ? scaleChannel((value & alphaMask) >>> alphaShift, alphaBits)
          : 255;
        continue;
      }

      // Palette formats: 1, 4 or 8 bits per pixel.
      const bitsIn = bitCount;
      const bitPosition = x * bitsIn;
      const byte = buffer[rowStart + (bitPosition >> 3)] ?? 0;
      const shift = 8 - bitsIn - (bitPosition & 7);
      const index = (byte >> shift) & ((1 << bitsIn) - 1);

      const entry = index * 4;
      out[target] = palette?.[entry] ?? 0;
      out[target + 1] = palette?.[entry + 1] ?? 0;
      out[target + 2] = palette?.[entry + 2] ?? 0;
      out[target + 3] = 255;
    }
  }

  return { width, height, channels: 4, data: out };
}

function popCount(mask: number): number {
  let count = 0;
  let value = mask >>> 0;
  while (value) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

export interface EncodeBmpOptions {
  /**
   * Keep the alpha channel by writing a 32-bit BITMAPV4HEADER. Alpha in BMP is
   * inconsistently supported by viewers, so the default is a 24-bit file, which
   * every reader handles.
   */
  keepAlpha?: boolean;
}

/**
 * Encodes raw RGBA pixels as a BMP.
 *
 * Writes 24-bit `BI_RGB` by default — the most compatible form — or a 32-bit
 * `BITMAPV4HEADER` with explicit channel masks when alpha must be preserved.
 */
export function encodeBmp(
  image: RawImage,
  options: EncodeBmpOptions = {},
): Buffer {
  const { width, height, data } = image;
  const withAlpha = options.keepAlpha === true;

  const bitCount = withAlpha ? 32 : 24;
  const headerSize = withAlpha ? 108 : 40; // BITMAPV4HEADER : BITMAPINFOHEADER
  const rowSize = Math.floor((bitCount * width + 31) / 32) * 4;
  const pixelBytes = rowSize * height;
  const pixelOffset = FILE_HEADER_BYTES + headerSize;

  const out = Buffer.alloc(pixelOffset + pixelBytes);

  // --- file header ----------------------------------------------------------
  out.write('BM', 0, 'ascii');
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(0, 6);
  out.writeUInt32LE(pixelOffset, 10);

  // --- DIB header -----------------------------------------------------------
  out.writeUInt32LE(headerSize, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22); // positive: rows stored bottom-up
  out.writeUInt16LE(1, 26); // colour planes
  out.writeUInt16LE(bitCount, 28);
  out.writeUInt32LE(withAlpha ? BI_BITFIELDS : BI_RGB, 30);
  out.writeUInt32LE(pixelBytes, 34);
  out.writeInt32LE(2835, 38); // ~72 DPI
  out.writeInt32LE(2835, 42);
  out.writeUInt32LE(0, 46);
  out.writeUInt32LE(0, 50);

  if (withAlpha) {
    out.writeUInt32LE(0x00ff0000, 54); // red
    out.writeUInt32LE(0x0000ff00, 58); // green
    out.writeUInt32LE(0x000000ff, 62); // blue
    out.writeUInt32LE(0xff000000, 66); // alpha
    out.write('BGRs', 70, 'ascii'); // sRGB colour space
  }

  // --- pixels ---------------------------------------------------------------
  for (let y = 0; y < height; y += 1) {
    const sourceRow = height - 1 - y; // flip to bottom-up
    const rowStart = pixelOffset + y * rowSize;

    for (let x = 0; x < width; x += 1) {
      const source = (sourceRow * width + x) * 4;
      const red = data[source] ?? 0;
      const green = data[source + 1] ?? 0;
      const blue = data[source + 2] ?? 0;
      const alpha = data[source + 3] ?? 255;

      if (withAlpha) {
        const at = rowStart + x * 4;
        out[at] = blue;
        out[at + 1] = green;
        out[at + 2] = red;
        out[at + 3] = alpha;
      } else {
        const at = rowStart + x * 3;
        out[at] = blue;
        out[at + 1] = green;
        out[at + 2] = red;
      }
    }
  }

  return out;
}

/** True when the buffer starts with the BMP signature. */
export function isBmp(buffer: Buffer): boolean {
  return buffer.length > 2 && buffer[0] === 0x42 && buffer[1] === 0x4d;
}
