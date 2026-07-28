import { z } from 'zod';

import { findRoute, getFormat } from '@/services/conversion/registry';
import type { ConversionOptions } from '@/types/conversion';

/**
 * Per-engine option schemas.
 *
 * Options arrive from the browser and are therefore untrusted: they are parsed
 * with `strict()` so unknown keys are rejected outright, and every numeric
 * bound is clamped before it can reach an encoder argument list.
 */

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const imageOptionsSchema = z
  .object({
    quality: z.number().int().min(1).max(100).optional(),
    width: z.number().int().min(1).max(20_000).optional(),
    height: z.number().int().min(1).max(20_000).optional(),
    fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).optional(),
    cropX: z.number().int().min(0).max(100_000).optional(),
    cropY: z.number().int().min(0).max(100_000).optional(),
    cropWidth: z.number().int().min(1).max(100_000).optional(),
    cropHeight: z.number().int().min(1).max(100_000).optional(),
    stripMetadata: z.boolean().optional(),
    background: z.string().regex(HEX_COLOR, 'Expected a hex colour').optional(),
    rotate: z
      .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
      .optional(),
    grayscale: z.boolean().optional(),
  })
  .strict();

export const mediaOptionsSchema = z
  .object({
    audioBitrate: z.number().int().min(32).max(512).optional(),
    videoBitrate: z.number().int().min(100).max(50_000).optional(),
    resolution: z
      .union([
        z.literal(240),
        z.literal(360),
        z.literal(480),
        z.literal(720),
        z.literal(1080),
        z.literal(1440),
        z.literal(2160),
      ])
      .optional(),
    fps: z.number().int().min(1).max(120).optional(),
    crf: z.number().int().min(0).max(51).optional(),
    audioOnly: z.boolean().optional(),
    startSeconds: z.number().min(0).max(86_400).optional(),
    durationSeconds: z.number().min(0.1).max(86_400).optional(),
    // 16 and 24 kHz are here for Opus, which cannot encode 44.1 kHz at all.
    sampleRate: z
      .union([
        z.literal(16000),
        z.literal(22050),
        z.literal(24000),
        z.literal(32000),
        z.literal(44100),
        z.literal(48000),
      ])
      .optional(),
    channels: z.union([z.literal(1), z.literal(2)]).optional(),
    normalizeLoudness: z.boolean().optional(),
  })
  .strict();

export const documentOptionsSchema = z
  .object({
    pageSize: z.enum(['a4', 'letter', 'legal']).optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    marginMm: z.number().min(0).max(50).optional(),
    sheet: z.string().max(120).optional(),
    delimiter: z.enum([',', ';', '\t', '|']).optional(),
    dpi: z.number().int().min(72).max(600).optional(),
    pages: z
      .string()
      .regex(
        /^(all|\d{1,4}(-\d{1,4})?)$/,
        'Expected "all", a page number or a range like 2-5',
      )
      .optional(),
  })
  .strict();

export const archiveOptionsSchema = z
  .object({
    compressionLevel: z.number().int().min(0).max(9).optional(),
  })
  .strict();

const SCHEMA_BY_ENGINE = {
  image: imageOptionsSchema,
  media: mediaOptionsSchema,
  document: documentOptionsSchema,
  spreadsheet: documentOptionsSchema,
  office: documentOptionsSchema,
  'pdf-render': documentOptionsSchema,
  'pdf-text': documentOptionsSchema,
  archive: archiveOptionsSchema,
} as const;

/**
 * Validates raw options against the engine that will handle the route.
 * Image-to-PDF is handled by the document engine but accepts image options, so
 * that pair is merged explicitly.
 */
export function parseOptions(
  from: string,
  to: string,
  raw: unknown,
):
  | { success: true; data: ConversionOptions }
  | { success: false; message: string } {
  const route = findRoute(from, to);
  if (!route) {
    return { success: false, message: `Cannot convert ${from} to ${to}.` };
  }

  const sourceFormat = getFormat(from);
  const isImageToPdf = sourceFormat?.category === 'image' && to === 'pdf';

  const schema = isImageToPdf
    ? imageOptionsSchema.merge(documentOptionsSchema)
    : SCHEMA_BY_ENGINE[route.engine];

  const result = schema.safeParse(raw ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      message: issue
        ? `Invalid option "${issue.path.join('.') || 'options'}": ${issue.message}`
        : 'Invalid conversion options.',
    };
  }

  return { success: true, data: result.data as ConversionOptions };
}

/**
 * Sensible defaults applied when the user does not override them.
 *
 * Keyed on the engine that will actually run, not on the target format alone:
 * GIF is an image format but a video source reaches it through ffmpeg, so
 * picking defaults by category would hand image options to the media schema —
 * which rejects them, failing every video-to-GIF conversion.
 */
export function defaultOptionsFor(from: string, to: string): ConversionOptions {
  const route = findRoute(from, to);
  if (!route) return {};

  switch (route.engine) {
    case 'image':
      return { quality: to === 'avif' ? 60 : 82, stripMetadata: true };
    case 'media':
      if (to === 'gif') return { fps: 15, resolution: 480 };
      if (getFormat(to)?.category === 'audio') {
        // Opus cannot encode 44.1 kHz; 48 kHz is its native rate.
        return { audioBitrate: 192, sampleRate: to === 'opus' ? 48000 : 44100 };
      }
      return { crf: 23, audioBitrate: 160 };
    case 'archive':
      return { compressionLevel: 6 };
    default:
      return {};
  }
}
