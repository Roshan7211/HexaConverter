import { describe, expect, it } from 'vitest';

import {
  clamp,
  fileExtension,
  fileStem,
  formatBytes,
  formatDuration,
  formatExtension,
  slugify,
  truncateFilename,
} from '@/utils';

describe('formatBytes', () => {
  it('scales through the unit ladder', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('accepts bigint sizes from the database', () => {
    expect(formatBytes(BigInt(1024 * 1024))).toBe('1.0 MB');
  });

  it('treats invalid input as zero', () => {
    expect(formatBytes(Number.NaN)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('picks a readable unit', () => {
    expect(formatDuration(820)).toBe('820ms');
    expect(formatDuration(4_200)).toBe('4.2s');
    expect(formatDuration(72_000)).toBe('1m 12s');
    expect(formatDuration(-1)).toBe('—');
  });
});

describe('filename helpers', () => {
  it('extracts extensions and stems', () => {
    expect(fileExtension('report.final.PDF')).toBe('pdf');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('noextension')).toBe('');
    expect(fileExtension('.hidden')).toBe('');
    expect(fileStem('report.final.pdf')).toBe('report.final');
    expect(fileStem('noextension')).toBe('noextension');
  });

  it('truncates long names but keeps the extension', () => {
    const result = truncateFilename('a'.repeat(80) + '.png', 24);
    expect(result.length).toBeLessThanOrEqual(25);
    expect(result.endsWith('.png')).toBe(true);
  });

  it('leaves short names untouched', () => {
    expect(truncateFilename('photo.png')).toBe('photo.png');
  });
});

describe('slugify', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('  Convert PNG to JPG!  ')).toBe('convert-png-to-jpg');
    expect(slugify('a__b  c')).toBe('a-b-c');
  });
});

describe('clamp', () => {
  it('bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe('formatExtension', () => {
  it('reads the compound archive extension', () => {
    expect(formatExtension('photos.tar.gz')).toBe('tgz');
    expect(formatExtension('PHOTOS.TAR.GZ')).toBe('tgz');
    expect(formatExtension('backup.tar.gzip')).toBe('tgz');
  });

  it('falls back to the plain extension', () => {
    expect(formatExtension('report.json.gz')).toBe('gz');
    expect(formatExtension('archive.7z')).toBe('7z');
    expect(formatExtension('clip.mp4')).toBe('mp4');
    expect(formatExtension('noextension')).toBe('');
  });
});
