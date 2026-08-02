/**
 * Archive toolkit contracts.
 *
 * Shared by the browser controls and the server, so an option chosen in the UI
 * is the same shape the service validates.
 */

export const ARCHIVE_OPERATIONS = ['EXTRACT', 'ARCHIVE', 'PROTECT'] as const;

export type ArchiveOperation = (typeof ARCHIVE_OPERATIONS)[number];

/** Formats the toolkit can write. RAR is absent because nothing free can. */
export const ARCHIVE_TARGETS = ['zip', '7z', 'tar', 'tgz', 'gz'] as const;

export type ArchiveTarget = (typeof ARCHIVE_TARGETS)[number];

export interface ArchiveOperationSpec {
  id: ArchiveOperation;
  /** URL segment, e.g. `/tools/archive/extract`. */
  slug: string;
  label: string;
  description: string;
  minFiles: number;
  maxFiles: number;
  /** Whether the operation accepts a password field. */
  usesPassword: boolean;
  /**
   * Value for the file input's `accept`, or undefined to accept anything.
   *
   * Carries MIME types as well as extensions on purpose. `accept` is matched
   * against the type the operating system reports for a file, and a list of
   * bare extensions leaves the browser to map them itself — which it can only
   * do for types the OS has registered. On a machine with no 7-Zip or RAR
   * tooling installed there is no mapping for `.7z` or `.rar`, and those files
   * are shown greyed out and unselectable.
   *
   * Extensions alone are also why `.tar.gz` cannot appear here: `accept` takes
   * a single extension per token, so a compound one matches nothing. `.gz`
   * covers those files, because that is the only suffix the browser sees.
   *
   * This is a convenience filter, never a control. Uploads are validated
   * server-side by magic bytes, which is what actually decides what is
   * accepted.
   */
  accept?: string;
}

export const ARCHIVE_OPERATION_SPECS: Readonly<
  Record<ArchiveOperation, ArchiveOperationSpec>
> = Object.freeze({
  EXTRACT: {
    id: 'EXTRACT',
    slug: 'extract',
    label: 'Extract archive',
    description:
      'Open a ZIP, RAR, 7Z, TAR or GZIP archive and download its contents. Password-protected archives are supported.',
    minFiles: 1,
    maxFiles: 1,
    usesPassword: true,
    accept: [
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.tgz',
      '.gz',
      'application/zip',
      'application/x-zip-compressed',
      'application/vnd.rar',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip',
      'application/x-compressed-tar',
      // Some systems report an archive as a generic byte stream rather than a
      // specific type. Without this they are unselectable even though the
      // server would accept them.
      'application/octet-stream',
    ].join(','),
  },
  ARCHIVE: {
    id: 'ARCHIVE',
    slug: 'compress',
    label: 'Create archive',
    description:
      'Compress files into a single ZIP, 7Z, TAR or TAR.GZ, with a choice of how hard to compress.',
    minFiles: 1,
    maxFiles: 50,
    usesPassword: false,
  },
  PROTECT: {
    id: 'PROTECT',
    slug: 'protect',
    label: 'Password-protect a ZIP',
    description:
      'Pack files into a ZIP encrypted with AES-256, so the contents cannot be read without the password.',
    minFiles: 1,
    maxFiles: 50,
    usesPassword: true,
  },
});

export const ARCHIVE_OPERATION_BY_SLUG: Readonly<
  Record<string, ArchiveOperationSpec>
> = Object.freeze(
  Object.fromEntries(
    Object.values(ARCHIVE_OPERATION_SPECS).map((spec) => [spec.slug, spec]),
  ),
);

/** One entry inside an archive, as reported back to the browser. */
export interface ArchiveListing {
  name: string;
  size: number;
  directory: boolean;
}
