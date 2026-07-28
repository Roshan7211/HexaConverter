import { readFile, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

import { decodeBmp, encodeBmp, isBmp } from '@/services/conversion/codecs/bmp';
import { logger } from '@/lib/logger';
import { getFormat } from '@/services/conversion/registry';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
  type ImageOptions,
} from '@/types/conversion';

/**
 * Raster and vector image conversion via libvips (sharp).
 *
 * Runs entirely in-process with bounded memory: `sequentialRead` streams the
 * decoder where the format allows it, and pixel limits reject decompression
 * bombs before allocation.
 */

/** Guards against decompression bombs (~215 megapixels, i.e. a 16k × 13k image). */
const MAX_PIXELS = 215_000_000;

/**
 * Opens a source file as a sharp pipeline.
 *
 * Two formats need help: libvips has no BMP support at all, so those are
 * decoded here and handed over as raw pixels; and HEIC decodes natively in most
 * builds but not all, so a WebAssembly decoder is used as a fallback rather
 * than failing on an iPhone photo.
 */
async function openSource(
  inputPath: string,
  sourceFormat: string,
  animated: boolean,
  density: number | undefined,
): Promise<sharp.Sharp> {
  if (sourceFormat === 'bmp') {
    const buffer = await readFile(inputPath);
    if (!isBmp(buffer)) {
      throw new ConversionError('That file is not a valid BMP image.');
    }
    const raw = decodeBmp(buffer);
    return sharp(raw.data, {
      raw: { width: raw.width, height: raw.height, channels: 4 },
    });
  }

  if (sourceFormat === 'heic') {
    // Many libvips builds parse the HEIF *container* but cannot decode its
    // HEVC pixels — `metadata()` succeeds and the decode then fails with a
    // seek error. So the native path is probed by actually decoding, not by
    // reading metadata, and any failure falls through to WebAssembly.
    try {
      const { data, info } = await sharp(inputPath, {
        limitInputPixels: MAX_PIXELS,
      })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
      });
    } catch (nativeError) {
      logger.info(
        'Native HEIC decode unavailable; using the WebAssembly decoder',
        {
          reason: (nativeError as Error).message,
        },
      );
    }

    const { default: decodeHeic } = await import('heic-decode');
    const buffer = await readFile(inputPath);

    try {
      const { width, height, data } = await decodeHeic({ buffer });
      return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } });
    } catch (error) {
      throw new ConversionError(
        'The HEIC image could not be decoded. Live Photos and some multi-image HEIC files are not supported.',
        { cause: error },
      );
    }
  }

  return sharp(inputPath, {
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
    failOn: 'error',
    animated,
    ...(density ? { density } : {}),
  });
}

/** Upper bound on SVG rasterisation to keep librsvg memory predictable. */
const MAX_SVG_DIMENSION = 8_000;

function qualityFor(options: ImageOptions, fallback: number): number {
  const quality = options.quality ?? fallback;
  return Math.min(100, Math.max(1, Math.round(quality)));
}

export const imageEngine: ConversionEngine = {
  id: 'image',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const { options, targetFormat, sourceFormat } = context;
    const target = getFormat(targetFormat);
    if (!target) {
      throw new ConversionError(`Unsupported target format: ${targetFormat}`);
    }

    context.onProgress(5);

    const isVectorSource = sourceFormat === 'svg';

    let pipeline = await openSource(
      context.inputPath,
      sourceFormat,
      sourceFormat === 'gif' || sourceFormat === 'webp',
      isVectorSource
        ? Math.min(
            600,
            Math.max(
              72,
              Math.round(72 * (options.width ? options.width / 512 : 4)),
            ),
          )
        : undefined,
    );

    let metadata: sharp.Metadata;
    try {
      metadata = await pipeline.metadata();
    } catch (error) {
      throw new ConversionError(
        'The image could not be read. It may be corrupt or use an unsupported encoding.',
        { cause: error },
      );
    }

    if (!metadata.format) {
      throw new ConversionError('The uploaded file is not a recognised image.');
    }

    context.onProgress(20);

    if (options.rotate) {
      pipeline = pipeline.rotate(options.rotate);
    } else if (!isVectorSource) {
      // Honour the EXIF orientation flag before metadata is stripped.
      pipeline = pipeline.rotate();
    }

    // Crop first: the rectangle is expressed in source pixels, so applying it
    // after a resize would move the region the user selected.
    if (
      options.cropWidth &&
      options.cropHeight &&
      options.cropX !== undefined &&
      options.cropY !== undefined
    ) {
      const sourceWidth = metadata.width ?? 0;
      const sourceHeight = metadata.height ?? 0;

      // The origin must be inside the image; the size is clamped to what is
      // actually available so a slightly oversized selection still works.
      if (options.cropX >= sourceWidth || options.cropY >= sourceHeight) {
        throw new ConversionError(
          `The crop starts outside the image, which is ${sourceWidth}×${sourceHeight} pixels.`,
        );
      }

      const left = options.cropX;
      const top = options.cropY;
      const width = Math.min(options.cropWidth, sourceWidth - left);
      const height = Math.min(options.cropHeight, sourceHeight - top);

      if (width < 1 || height < 1) {
        throw new ConversionError(
          `The crop area falls outside the image, which is ${sourceWidth}×${sourceHeight} pixels.`,
        );
      }

      pipeline = pipeline.extract({ left, top, width, height });
    }

    if (options.width || options.height) {
      pipeline = pipeline.resize({
        width: options.width
          ? Math.min(options.width, MAX_SVG_DIMENSION * 4)
          : undefined,
        height: options.height
          ? Math.min(options.height, MAX_SVG_DIMENSION * 4)
          : undefined,
        fit: options.fit ?? 'inside',
        withoutEnlargement: !isVectorSource,
        background: options.background ?? { r: 255, g: 255, b: 255, alpha: 0 },
      });
    } else if (isVectorSource) {
      // Vectors have no intrinsic pixel size; cap the rasterised output.
      const width = metadata.width ?? 1024;
      if (width > MAX_SVG_DIMENSION) {
        pipeline = pipeline.resize({ width: MAX_SVG_DIMENSION });
      }
    }

    if (options.grayscale) pipeline = pipeline.grayscale();

    // Flatten transparency when the destination cannot represent it.
    if (!target.supportsAlpha && (metadata.hasAlpha || isVectorSource)) {
      pipeline = pipeline.flatten({
        background: options.background ?? '#ffffff',
      });
    }

    // Metadata is dropped by default in libvips; re-attach it only on request
    // so EXIF GPS coordinates are not leaked in shared files.
    if (options.stripMetadata === false) {
      pipeline = pipeline.withMetadata();
    }

    context.onProgress(35);

    switch (targetFormat) {
      case 'jpg':
        pipeline = pipeline.jpeg({
          quality: qualityFor(options, 82),
          progressive: true,
          mozjpeg: true,
          chromaSubsampling: '4:2:0',
        });
        break;
      case 'png':
        pipeline = pipeline.png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: qualityFor(options, 100) < 100,
          quality: qualityFor(options, 100),
        });
        break;
      case 'webp':
        pipeline = pipeline.webp({
          quality: qualityFor(options, 82),
          effort: 4,
          smartSubsample: true,
        });
        break;
      case 'avif':
        pipeline = pipeline.avif({
          quality: qualityFor(options, 60),
          effort: 4,
          chromaSubsampling: '4:2:0',
        });
        break;
      case 'tiff':
        pipeline = pipeline.tiff({
          quality: qualityFor(options, 90),
          compression: 'lzw',
        });
        break;
      case 'gif':
        pipeline = pipeline.gif({ effort: 7 });
        break;
      case 'bmp': {
        // libvips cannot write BMP; take raw pixels and encode them here.
        context.signal.throwIfAborted();

        const { data, info } = await pipeline
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        const bmp = encodeBmp(
          { width: info.width, height: info.height, channels: 4, data },
          // Only carry an alpha channel when the image actually has one:
          // 24-bit BMP is far more widely readable.
          { keepAlpha: Boolean(metadata.hasAlpha) && !options.background },
        );

        await writeFile(context.outputPath, bmp);
        context.onProgress(100);

        return {
          outputPath: context.outputPath,
          mime: target.mime,
          detail: `${info.width}×${info.height}`,
        };
      }
      default:
        throw new ConversionError(`Unsupported target format: ${targetFormat}`);
    }

    context.signal.throwIfAborted();

    try {
      const info = await pipeline.toFile(context.outputPath);
      context.onProgress(100);
      return {
        outputPath: context.outputPath,
        mime: target.mime,
        detail: `${info.width}×${info.height}`,
      };
    } catch (error) {
      if (error instanceof ConversionError) throw error;
      throw new ConversionError(
        'The image could not be encoded to the requested format.',
        { cause: error },
      );
    }
  },
};

/** Rasterises any supported image to PNG — used by the PDF wrapper. */
export async function rasterizeToPng(
  inputPath: string,
  maxDimension = 4_000,
): Promise<{ data: Buffer; width: number; height: number }> {
  const image = sharp(inputPath, {
    limitInputPixels: MAX_PIXELS,
    sequentialRead: true,
  });

  const metadata = await image.metadata();
  const width = metadata.width ?? maxDimension;
  const height = metadata.height ?? maxDimension;

  const pipeline =
    Math.max(width, height) > maxDimension
      ? image.resize({
          width: maxDimension,
          height: maxDimension,
          fit: 'inside',
        })
      : image;

  const result = await pipeline.png({ compressionLevel: 9 }).toBuffer({
    resolveWithObject: true,
  });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}
