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
