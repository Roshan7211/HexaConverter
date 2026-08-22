import type { Category } from '@/types';
import type { Guide } from '@/content/guides/types';

import { archiveFormatsCompared } from '@/content/guides/archive-formats-compared';
import { audioBitrateExplained } from '@/content/guides/audio-bitrate-explained';
import { containersVsCodecs } from '@/content/guides/containers-vs-codecs';
import { csvLeadingZeros } from '@/content/guides/csv-leading-zeros';
import { gifVsVideo } from '@/content/guides/gif-vs-video';
import { imageTransparency } from '@/content/guides/image-transparency';
import { pdfToImageResolution } from '@/content/guides/pdf-to-image-resolution';
import { photoMetadataExif } from '@/content/guides/photo-metadata-exif';
import { presentationFormats } from '@/content/guides/presentation-formats';
import { pngVsJpegFileSize } from '@/content/guides/png-vs-jpeg-file-size';
import { scannedPdfNoText } from '@/content/guides/scanned-pdf-no-text';
import { webpVsAvif } from '@/content/guides/webp-vs-avif';
import { wordToPdfWhatChanges } from '@/content/guides/word-to-pdf-what-changes';

/**
 * The guide library.
 *
 * Order here is the order they appear in listings: broadly, the questions
 * people arrive with most often come first.
 */
export const GUIDES: readonly Guide[] = Object.freeze([
  pngVsJpegFileSize,
  imageTransparency,
  containersVsCodecs,
  csvLeadingZeros,
  wordToPdfWhatChanges,
  photoMetadataExif,
  webpVsAvif,
  audioBitrateExplained,
  scannedPdfNoText,
  gifVsVideo,
  pdfToImageResolution,
  archiveFormatsCompared,
  presentationFormats,
]);

const BY_SLUG: Readonly<Record<string, Guide>> = Object.freeze(
  Object.fromEntries(GUIDES.map((guide) => [guide.slug, guide])),
);

export function guideBySlug(slug: string): Guide | null {
  return BY_SLUG[slug] ?? null;
}

export function guidesForTopic(topic: Category): Guide[] {
  return GUIDES.filter((guide) => guide.topic === topic);
}

/**
 * Guides worth surfacing on a conversion page, most relevant first.
 *
 * A guide that names both formats is a better match than one naming either, so
 * a PNG-to-JPEG page leads with the piece about those two rather than with a
 * general one about metadata. Capped by the caller.
 */
export function guidesForConversion(from: string, to: string): Guide[] {
  return GUIDES.map((guide) => {
    const matches =
      Number(guide.formats.includes(from)) + Number(guide.formats.includes(to));
    return { guide, matches };
  })
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => b.matches - a.matches)
    .map((entry) => entry.guide);
}
