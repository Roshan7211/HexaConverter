import { describe, expect, it } from 'vitest';

import { defaultOptionsFor, parseOptions } from '@/services/conversion/options';
import { CONVERSION_ROUTES } from '@/services/conversion/registry';
import { contactSchema, nameSchema } from '@/api/schemas';

describe('name validation', () => {
  it('accepts ordinary names including spaces and accents', () => {
    expect(nameSchema.safeParse('Ada Lovelace').success).toBe(true);
    expect(nameSchema.safeParse('José Álvarez-Pérez').success).toBe(true);
  });

  it('rejects markup and control characters', () => {
    expect(nameSchema.safeParse('<script>alert(1)</script>').success).toBe(
      false,
    );
    expect(
      nameSchema.safeParse(`bad${String.fromCharCode(7)}name`).success,
    ).toBe(false);
    expect(nameSchema.safeParse('a').success).toBe(false);
  });
});

describe('contact form', () => {
  it('normalises the email address', () => {
    const result = contactSchema.safeParse({
      name: 'Ada Lovelace',
      email: '  ADA@Example.COM ',
      subject: 'Question',
      message: 'This message is definitely long enough to pass validation.',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ada@example.com');
  });

  it('enforces a minimum message length', () => {
    const base = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Question',
    };
    expect(
      contactSchema.safeParse({ ...base, message: 'too short' }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({
        ...base,
        message: 'This message is definitely long enough to pass validation.',
      }).success,
    ).toBe(true);
  });
});

describe('conversion options', () => {
  it('accepts valid image options', () => {
    expect(
      parseOptions('png', 'jpg', { quality: 90, stripMetadata: true }).success,
    ).toBe(true);
  });

  it('rejects unknown keys', () => {
    expect(
      parseOptions('png', 'jpg', { quality: 90, shell: 'rm -rf /' }).success,
    ).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(parseOptions('png', 'jpg', { quality: 900 }).success).toBe(false);
    expect(parseOptions('mp4', 'mp3', { audioBitrate: 99_999 }).success).toBe(
      false,
    );
    expect(parseOptions('zip', 'tar', { compressionLevel: 42 }).success).toBe(
      false,
    );
  });

  it('rejects options for an unsupported route', () => {
    expect(parseOptions('png', 'mp3', {}).success).toBe(false);
  });

  it('validates the PDF page-range syntax', () => {
    expect(parseOptions('pdf', 'jpg', { pages: '2-5' }).success).toBe(true);
    expect(parseOptions('pdf', 'jpg', { pages: 'all' }).success).toBe(true);
    expect(parseOptions('pdf', 'jpg', { pages: '1;rm' }).success).toBe(false);
  });
});

describe('default options', () => {
  /**
   * The defaults are merged into the user's options and then parsed by the
   * strict per-engine schema, so a default the schema does not know about is
   * not a cosmetic mismatch — it fails the whole conversion with a 422.
   */
  function accepted(from: string, to: string): boolean {
    return parseOptions(from, to, defaultOptionsFor(from, to)).success;
  }

  it('produces defaults its own schema accepts, for every route', () => {
    const rejected = CONVERSION_ROUTES.filter(
      (route) => !accepted(route.from, route.to),
    );
    expect(rejected.map((r) => `${r.from}->${r.to}`)).toEqual([]);
  });

  it('picks defaults by engine, not by target category', () => {
    // GIF is an image format reached through ffmpeg from a video source.
    expect(defaultOptionsFor('mp4', 'gif')).toEqual({
      fps: 15,
      resolution: 480,
    });
    // ...and through libvips from an image source.
    expect(defaultOptionsFor('png', 'gif')).toEqual({
      quality: 82,
      stripMetadata: true,
    });
  });

  it('gives audio targets bitrate and sample rate', () => {
    expect(defaultOptionsFor('mp4', 'mp3')).toEqual({
      audioBitrate: 192,
      sampleRate: 44100,
    });
  });

  it('returns nothing for a route that does not exist', () => {
    expect(defaultOptionsFor('png', 'mp3')).toEqual({});
  });
});
