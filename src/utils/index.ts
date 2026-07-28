/**
 * Pure, dependency-free helpers.
 *
 * Nothing here may import from `services/`, `database/` or `app/` — utilities
 * sit at the bottom of the dependency graph and are safe to use from any layer,
 * on the server or in the browser.
 */

export { cn } from '@/utils/cn';
export {
  fileExtension,
  fileStem,
  formatExtension,
  truncateFilename,
} from '@/utils/file';
export {
  formatBytes,
  formatDate,
  formatDuration,
  formatRelativeTime,
} from '@/utils/format';
export { clamp, serializeBigInt } from '@/utils/number';
export { absoluteUrl, slugify } from '@/utils/string';
