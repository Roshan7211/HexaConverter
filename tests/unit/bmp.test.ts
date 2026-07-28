import { describe, expect, it } from 'vitest';

import {
  BmpError,
  decodeBmp,
  encodeBmp,
  isBmp,
  type RawImage,
} from '@/services/conversion/codecs/bmp';

/**
 * BMP codec.
 *
 * libvips cannot read or write BMP, so this codec is the only thing standing
 * between a user's bitmap and a corrupt download. The byte-level details it
 * has to get right — BGR channel order, bottom-up row storage, 4-byte row
 * padding — are all silent failures if wrong, so each is pinned here.
 */

function gradient(width: number, height: number, alpha = 255): RawImage {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = Math.round((x / Math.max(1, width - 1)) * 255);
      data[index + 1] = Math.round((y / Math.max(1, height - 1)) * 255);
      data[index + 2] = 64;
      data[index + 3] = alpha;
    }
  }

  return { width, height, channels: 4, data };
}

function pixel(image: RawImage, x: number, y: number): number[] {
  const index = (y * image.width + x) * 4;
  return [
    image.data[index]!,
    image.data[index + 1]!,
    image.data[index + 2]!,
    image.data[index + 3]!,
  ];
}

describe('encodeBmp', () => {
  it('writes a valid file header', () => {
    const bmp = encodeBmp(gradient(4, 4));

    expect(bmp.subarray(0, 2).toString('ascii')).toBe('BM');
    expect(bmp.readUInt32LE(2)).toBe(bmp.length); // declared size matches
    expect(bmp.readUInt32LE(10)).toBe(54); // 14-byte file + 40-byte DIB header
    expect(bmp.readUInt32LE(14)).toBe(40); // BITMAPINFOHEADER
    expect(bmp.readInt32LE(18)).toBe(4); // width
    expect(bmp.readInt32LE(22)).toBe(4); // positive height: bottom-up
    expect(bmp.readUInt16LE(28)).toBe(24); // bits per pixel
  });

  it('pads each row to a four-byte boundary', () => {
    // 3 pixels x 3 bytes = 9 bytes, padded to 12.
    const bmp = encodeBmp(gradient(3, 2));
    expect(bmp.length).toBe(54 + 12 * 2);
  });

  it('writes a 32-bit V4 header when alpha is kept', () => {
    const bmp = encodeBmp(gradient(2, 2, 128), { keepAlpha: true });

    expect(bmp.readUInt32LE(14)).toBe(108); // BITMAPV4HEADER
    expect(bmp.readUInt16LE(28)).toBe(32);
    expect(bmp.readUInt32LE(30)).toBe(3); // BI_BITFIELDS
    expect(bmp.readUInt32LE(66)).toBe(0xff000000); // alpha mask
  });

  it('stores channels in BGR order', () => {
    const image: RawImage = {
      width: 1,
      height: 1,
      channels: 4,
      data: Buffer.from([10, 20, 30, 255]), // R=10 G=20 B=30
    };

    const bmp = encodeBmp(image);
    expect([bmp[54], bmp[55], bmp[56]]).toEqual([30, 20, 10]);
  });
});

describe('decodeBmp', () => {
  it('round-trips 24-bit pixels exactly', () => {
    const source = gradient(64, 48);
    const decoded = decodeBmp(encodeBmp(source));

    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);

    for (const [x, y] of [
      [0, 0],
      [63, 0],
      [0, 47],
      [63, 47],
      [32, 24],
    ] as const) {
      expect(pixel(decoded, x, y).slice(0, 3)).toEqual(
        pixel(source, x, y).slice(0, 3),
      );
    }
  });

  it('round-trips 32-bit pixels including alpha', () => {
    const source = gradient(16, 16, 128);
    const decoded = decodeBmp(encodeBmp(source, { keepAlpha: true }));

    expect(pixel(decoded, 8, 8)).toEqual(pixel(source, 8, 8));
  });

  it('reports opaque pixels when there is no alpha channel', () => {
    const decoded = decodeBmp(encodeBmp(gradient(8, 8, 40)));
    // A 24-bit BMP carries no alpha, so everything reads back opaque.
    expect(pixel(decoded, 4, 4)[3]).toBe(255);
  });

  it('reads top-down rows when the height is negative', () => {
    const bmp = encodeBmp(gradient(4, 4));
    const topDown = Buffer.from(bmp);

    // Flip the stored row order and mark the header top-down.
    topDown.writeInt32LE(-4, 22);
    // 4px * 3 bytes = 12, which is already 4-byte aligned.
    const rowSize = 12;
    for (let row = 0; row < 4; row += 1) {
      bmp.copy(
        topDown,
        54 + row * rowSize,
        54 + (3 - row) * rowSize,
        54 + (4 - row) * rowSize,
      );
    }

    const normal = decodeBmp(bmp);
    const flipped = decodeBmp(topDown);
    expect(pixel(flipped, 0, 0).slice(0, 3)).toEqual(
      pixel(normal, 0, 0).slice(0, 3),
    );
  });

  it('handles a single-pixel image', () => {
    const one: RawImage = {
      width: 1,
      height: 1,
      channels: 4,
      data: Buffer.from([255, 128, 0, 255]),
    };

    expect(pixel(decodeBmp(encodeBmp(one)), 0, 0).slice(0, 3)).toEqual([
      255, 128, 0,
    ]);
  });

  it('rejects a file without the BM signature', () => {
    expect(() => decodeBmp(Buffer.from('not an image at all'))).toThrow(
      BmpError,
    );
    expect(() => decodeBmp(Buffer.from('not an image at all'))).toThrow(
      /not a BMP/,
    );
  });

  it('rejects a truncated file', () => {
    const bmp = encodeBmp(gradient(32, 32));
    expect(() => decodeBmp(bmp.subarray(0, 200))).toThrow(/truncated/);
  });

  it('rejects run-length encoded bitmaps with an actionable message', () => {
    const bmp = encodeBmp(gradient(4, 4));
    bmp.writeUInt32LE(1, 30); // BI_RLE8

    expect(() => decodeBmp(bmp)).toThrow(/Run-length encoded/);
  });

  it('rejects an unsupported colour depth', () => {
    const bmp = encodeBmp(gradient(4, 4));
    bmp.writeUInt16LE(7, 28);

    expect(() => decodeBmp(bmp)).toThrow(/colour depth/);
  });

  it('rejects zero dimensions', () => {
    const bmp = encodeBmp(gradient(4, 4));
    bmp.writeInt32LE(0, 18);

    expect(() => decodeBmp(bmp)).toThrow(/zero width or height/);
  });
});

describe('isBmp', () => {
  it('recognises the signature without parsing', () => {
    expect(isBmp(encodeBmp(gradient(2, 2)))).toBe(true);
    expect(isBmp(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(isBmp(Buffer.alloc(0))).toBe(false);
  });
});
