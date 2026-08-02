import { describe, expect, it } from 'vitest';

import { ARCHIVE_OPERATION_SPECS } from '@/types/archives';

import {
  ACCEPTED_INPUT_EXTENSIONS,
  CONVERSION_ROUTES,
  FORMATS,
  findRoute,
  getFormat,
  parseRouteSlug,
  resolveFormatId,
  PUBLISHED_ROUTES,
  routeSlug,
  targetsFor,
} from '@/services/conversion/registry';

describe('format catalogue', () => {
  it('resolves aliases and extensions to canonical ids', () => {
    expect(resolveFormatId('JPEG')).toBe('jpg');
    expect(resolveFormatId('.jpg')).toBe('jpg');
    expect(resolveFormatId('tif')).toBe('tiff');
    expect(resolveFormatId('tar.gz')).toBe('tgz');
    expect(resolveFormatId('exe')).toBeNull();
  });

  it('never declares a route to or from an unknown format', () => {
    for (const route of CONVERSION_ROUTES) {
      expect(FORMATS[route.from], `unknown source ${route.from}`).toBeDefined();
      expect(FORMATS[route.to], `unknown target ${route.to}`).toBeDefined();
    }
  });

  it('never targets a format that cannot be written', () => {
    for (const route of CONVERSION_ROUTES) {
      expect(FORMATS[route.to]!.canOutput, `${route.to} is input-only`).toBe(
        true,
      );
    }
  });

  it('never sources a format that cannot be read', () => {
    for (const route of CONVERSION_ROUTES) {
      expect(
        FORMATS[route.from]!.canInput,
        `${route.from} is output-only`,
      ).toBe(true);
    }
  });

  it('contains no duplicates', () => {
    const seen = new Set<string>();
    for (const route of CONVERSION_ROUTES) {
      const key = `${route.from}>${route.to}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('allows same-format image routes so images can be edited in place', () => {
    // Crop, resize, rotate and re-compress are useful without changing format.
    for (const format of ['png', 'jpg', 'webp', 'gif', 'tiff', 'bmp']) {
      expect(findRoute(format, format)?.engine, `${format} to ${format}`).toBe(
        'image',
      );
    }
  });

  it('keeps identity routes out of the published landing pages', () => {
    for (const route of PUBLISHED_ROUTES) {
      expect(route.from).not.toBe(route.to);
    }
    expect(PUBLISHED_ROUTES.length).toBeLessThan(CONVERSION_ROUTES.length);
  });

  it('resolves audio and video identity routes to the media engine', () => {
    // Trim, compress and resolution changes are useful without leaving MP4.
    for (const format of ['mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav']) {
      expect(findRoute(format, format)?.engine, `${format} to ${format}`).toBe(
        'media',
      );
    }
  });

  it('does not create identity routes where they mean nothing', () => {
    // Re-encoding a PDF as a PDF or a ZIP as a ZIP has no user-facing effect;
    // the PDF toolkit handles same-format PDF work on its own endpoint.
    for (const format of ['pdf', 'docx', 'zip', 'csv', 'txt']) {
      expect(findRoute(format, format), `${format} to ${format}`).toBeNull();
    }
  });

  it('round-trips every published route through its slug', () => {
    for (const route of PUBLISHED_ROUTES) {
      const parsed = parseRouteSlug(routeSlug(route));
      expect(parsed).not.toBeNull();
      expect(parsed!.from).toBe(route.from);
      expect(parsed!.to).toBe(route.to);
    }
  });

  it('rejects malformed or unsupported slugs', () => {
    expect(parseRouteSlug('png-to-exe')).toBeNull();
    expect(parseRouteSlug('png_to_jpg')).toBeNull();
  });

  it('routes popular conversions through the expected engine', () => {
    expect(findRoute('png', 'jpg')?.engine).toBe('image');
    expect(findRoute('mp4', 'mp3')?.engine).toBe('media');
    expect(findRoute('docx', 'pdf')?.engine).toBe('office');
    expect(findRoute('docx', 'pdf')?.requires).toBe('libreoffice');
    expect(findRoute('pdf', 'jpg')?.engine).toBe('pdf-render');
    expect(findRoute('csv', 'xlsx')?.engine).toBe('spreadsheet');
    expect(findRoute('zip', 'tgz')?.engine).toBe('archive');
    expect(findRoute('png', 'pdf')?.engine).toBe('document');
  });

  it('prefers the in-process engine when a native one also exists', () => {
    // txt to pdf must not be handed to LibreOffice: pdf-lib handles it locally.
    expect(findRoute('txt', 'pdf')?.requires).toBeUndefined();
    expect(findRoute('csv', 'xlsx')?.requires).toBeUndefined();
  });

  it('declares no hard requirement for PDF rasterisation', () => {
    // The engine uses Poppler when the host has it and falls back to PDF.js
    // otherwise, so these routes are always satisfiable. Declaring `poppler`
    // here would hide them on every host that cannot install system packages —
    // which is precisely where the fallback is needed.
    for (const target of ['jpg', 'png', 'tiff', 'txt'] as const) {
      expect(findRoute('pdf', target)?.requires).toBeUndefined();
    }
  });

  it('exposes at least one target for every accepted input extension', () => {
    for (const extension of ACCEPTED_INPUT_EXTENSIONS) {
      const id = resolveFormatId(extension);
      expect(id).not.toBeNull();
      expect(targetsFor(id!).length).toBeGreaterThan(0);
    }
  });
});

describe('archive formats', () => {
  it('opens RAR but never produces one', () => {
    // RAR compression is proprietary: no free encoder exists, so offering it
    // as a target would be a route that can only ever fail.
    expect(getFormat('rar')?.canOutput).toBe(false);
    expect(findRoute('rar', 'zip')?.engine).toBe('archive');
    expect(findRoute('zip', 'rar')).toBeNull();
    expect(findRoute('7z', 'rar')).toBeNull();
  });

  it('repacks every openable archive into every creatable one', () => {
    for (const from of ['zip', 'tar', 'tgz', '7z', 'rar', 'gz']) {
      for (const to of ['zip', 'tar', 'tgz', '7z']) {
        if (from === to) continue;
        expect(findRoute(from, to)?.engine, `${from} to ${to}`).toBe('archive');
      }
    }
  });

  it('keeps GZIP and TAR.GZ as separate formats', () => {
    // `.gz` is a single compressed stream; `.tar.gz` is an archive. Treating
    // them as one alias would gunzip a tarball into an unopened `.tar`.
    expect(getFormat('gz')?.id).toBe('gz');
    expect(getFormat('tgz')?.id).toBe('tgz');
    expect(resolveFormatId('tar.gz')).toBe('tgz');
    expect(resolveFormatId('gz')).toBe('gz');
  });
});

describe('archive file-input accept lists', () => {
  it('uses only tokens the accept attribute understands', () => {
    for (const spec of Object.values(ARCHIVE_OPERATION_SPECS)) {
      if (!spec.accept) continue;

      for (const token of spec.accept.split(',')) {
        // `accept` takes one extension per token or a MIME type. A compound
        // suffix like `.tar.gz` matches nothing and silently narrows the
        // picker, which is how every archive ended up greyed out.
        if (token.startsWith('.')) {
          expect(token.slice(1)).not.toContain('.');
        } else {
          expect(token).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
        }
      }
    }
  });

  it('offers MIME types alongside extensions for extraction', () => {
    const accept = ARCHIVE_OPERATION_SPECS.EXTRACT.accept ?? '';
    // Extensions alone rely on the OS having a mapping registered; a machine
    // without 7-Zip or RAR installed then greys those files out.
    expect(accept).toContain('.7z');
    expect(accept).toContain('application/x-7z-compressed');
    expect(accept).toContain('application/octet-stream');
  });
});
