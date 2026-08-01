import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { encodeBmp } from '@/services/conversion/codecs/bmp';
import { rasterizeToPng } from '@/services/conversion/engines/image.engine';

/**
 * The image-to-PDF wrapper's decode step.
 *
 * `rasterizeToPng` is the only image read that does not go through the engine's
 * own `run`, and libvips cannot open BMP or (in many builds) HEIC. Reading
 * those with sharp directly fails with a bare "unsupported image format", which
 * surfaces to the user as an unexplained job failure on `bmp → pdf` while every
 * other target from the same file converts fine. So the formats that need a
 * hand-rolled decoder are pinned here rather than left to the PDF route's
 * integration behaviour.
 */

async function tempFile(name: string, bytes: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'hexa-raster-'));
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return file;
}

function solid(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = 200;
    data[i * 4 + 1] = 60;
    data[i * 4 + 2] = 40;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe('rasterizeToPng', () => {
  it('reads a BMP, which libvips cannot open', async () => {
    // 24-bit, the default: it is what libvips would have to read and cannot.
    const bmp = encodeBmp({
      width: 24,
      height: 16,
      channels: 4,
      data: solid(24, 16),
    });
    const file = await tempFile('image.bmp', bmp);

    const result = await rasterizeToPng(file);

    expect(result.width).toBe(24);
    expect(result.height).toBe(16);
    expect((await sharp(result.data).metadata()).format).toBe('png');
  });

  it('still reads the formats libvips handles natively', async () => {
    const png = await sharp({
      create: {
        width: 20,
        height: 10,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();
    const file = await tempFile('image.png', png);

    const result = await rasterizeToPng(file);

    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
  });

  it('scales an oversized image down to the cap', async () => {
    const png = await sharp({
      create: {
        width: 900,
        height: 300,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    const file = await tempFile('wide.png', png);

    const result = await rasterizeToPng(file, 300);

    expect(result.width).toBe(300);
    expect(result.height).toBe(100);
  });
});
