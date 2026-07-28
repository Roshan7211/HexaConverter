/** Filename helpers shared by the browser and the server. */

/** Extension without the dot, lowercased. Empty string when absent. */
export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  if (index <= 0 || index === filename.length - 1) return '';
  return filename.slice(index + 1).toLowerCase();
}

/**
 * Extension used to identify a file's format.
 *
 * Differs from `fileExtension` for the one compound extension that matters:
 * `photos.tar.gz` is a TAR.GZ archive, and reading only `gz` off the end would
 * gunzip it into a bare `.tar` the user then has to unpack a second time.
 */
export function formatExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.gzip')) return 'tgz';
  return fileExtension(filename);
}

/** Filename with the extension removed. */
export function fileStem(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index <= 0 ? filename : filename.slice(0, index);
}

/** Shortens a long filename while keeping its extension visible. */
export function truncateFilename(filename: string, max = 28): string {
  if (filename.length <= max) return filename;
  const extension = fileExtension(filename);
  const stem = fileStem(filename);
  const keep = Math.max(4, max - extension.length - 4);
  return `${stem.slice(0, keep)}…${extension ? `.${extension}` : ''}`;
}
