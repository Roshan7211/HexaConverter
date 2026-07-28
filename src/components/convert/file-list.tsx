'use client';

import { AnimatePresence } from 'framer-motion';

import { FileRow } from '@/components/convert/file-row';
import type { ConversionItem } from '@/hooks/use-conversion';

/**
 * The queued files, with their enter and exit animations.
 *
 * Extracted from `Converter` for one reason: it owns the `AnimatePresence`
 * import, and therefore Framer Motion. The converter is the main content of 249
 * prerendered landing pages, so anything imported at its top level is
 * downloaded by every visitor arriving from search — including the majority who
 * never add a file. Keeping the animation library behind this boundary means it
 * is fetched when the first file appears and not before.
 *
 * The animations themselves are unchanged; only where their code lives is.
 */
export function FileList({
  items,
  targetFormat,
  onRemove,
  onCancel,
  onRetryUpload,
}: {
  items: readonly ConversionItem[];
  targetFormat: string;
  onRemove: (localId: string) => void;
  onCancel: (localId: string) => void;
  onRetryUpload: (localId: string) => void;
}) {
  return (
    <ul className="space-y-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <FileRow
            key={item.localId}
            item={item}
            targetFormat={targetFormat}
            onRemove={onRemove}
            onCancel={onCancel}
            onRetryUpload={onRetryUpload}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
}
