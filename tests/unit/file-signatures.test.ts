import { describe, expect, it } from 'vitest';

import {
  isExtensionConsistent,
  sniffContainer,
} from '@/services/upload/file-signatures';

/** Builds a buffer of `length` bytes beginning with the given prefix. */
function withPrefix(prefix: number[] | string, length = 600): Uint8Array {
  const buffer = new Uint8Array(length);
  const bytes =
    typeof prefix === 'string'
      ? Array.from(prefix, (char) => char.charCodeAt(0))
      : prefix;
  buffer.set(bytes, 0);
  // Pad with printable bytes so the text heuristic cannot misfire.
  buffer.fill(0x41, bytes.length);
  return buffer;
}

function ascii(value: string): number[] {
  return Array.from(value, (char) => char.charCodeAt(0));
}

describe('container sniffing', () => {
  it('identifies image containers', () => {
    expect(sniffContainer(withPrefix([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(
      sniffContainer(
        withPrefix([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('png');
    expect(sniffContainer(withPrefix('GIF89a'))).toBe('gif');
    expect(sniffContainer(withPrefix([0x49, 0x49, 0x2a, 0x00]))).toBe('tiff');
  });

  it('distinguishes RIFF payloads by their form type', () => {
    const riff = (form: string) => {
      const buffer = withPrefix('RIFF');
      buffer.set(ascii(form), 8);
      return buffer;
    };

    expect(sniffContainer(riff('WEBP'))).toBe('webp');
    expect(sniffContainer(riff('WAVE'))).toBe('wav');
    expect(sniffContainer(riff('AVI '))).toBe('avi');
    expect(sniffContainer(riff('XXXX'))).toBeNull();
  });

  it('separates ISO-BMFF images from audio and video', () => {
    const ftyp = (brand: string) => {
      const buffer = withPrefix([0x00, 0x00, 0x00, 0x20]);
      buffer.set(ascii('ftyp'), 4);
      buffer.set(ascii(brand), 8);
      return buffer;
    };

    expect(sniffContainer(ftyp('avif'))).toBe('iso-bmff-image');
    expect(sniffContainer(ftyp('heic'))).toBe('iso-bmff-image');
    expect(sniffContainer(ftyp('isom'))).toBe('iso-bmff-av');
    expect(sniffContainer(ftyp('qt  '))).toBe('iso-bmff-av');
  });

  it('identifies documents and archives', () => {
    expect(sniffContainer(withPrefix('%PDF-1.7'))).toBe('pdf');
    expect(sniffContainer(withPrefix([0x50, 0x4b, 0x03, 0x04]))).toBe('zip');
    expect(sniffContainer(withPrefix([0x1f, 0x8b, 0x08]))).toBe('gzip');
    expect(
      sniffContainer(
        withPrefix([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      ),
    ).toBe('ole-compound');
  });

  it('finds the ustar marker at offset 257', () => {
    const buffer = new Uint8Array(600).fill(0x20);
    buffer.set(ascii('ustar'), 257);
    expect(sniffContainer(buffer)).toBe('tar');
  });

  it('separates ADTS AAC from MP3, which share the 0xFF sync byte', () => {
    // Both formats begin 0xFF; only the layer bits differ. Getting this wrong
    // makes every .aac upload fail as an extension mismatch.
    const frame = (second: number) =>
      withPrefix([0xff, second, 0x50, 0x80, 0x00, 0x1f, 0xfc]);

    for (const second of [0xf0, 0xf1, 0xf8, 0xf9]) {
      expect(
        sniffContainer(frame(second)),
        `ADTS 0x${second.toString(16)}`,
      ).toBe('aac');
    }

    for (const second of [0xfa, 0xfb, 0xf2, 0xf3]) {
      expect(
        sniffContainer(frame(second)),
        `MPEG 0x${second.toString(16)}`,
      ).toBe('mp3');
    }

    expect(sniffContainer(withPrefix('ID3'))).toBe('mp3');
  });

  it('accepts each audio extension against its own container', () => {
    expect(isExtensionConsistent('aac', 'aac')).toBe(true);
    expect(isExtensionConsistent('mp3', 'mp3')).toBe(true);
    expect(isExtensionConsistent('mp3', 'aac')).toBe(false);
    expect(isExtensionConsistent('aac', 'mp3')).toBe(false);
  });

  it('treats UTF-8 text as text and binary noise as unknown', () => {
    expect(sniffContainer(new TextEncoder().encode('name,value'))).toBe('text');
    expect(
      sniffContainer(new TextEncoder().encode('<svg xmlns="x"></svg>')),
    ).toBe('svg');

    const binary = new Uint8Array(600).fill(0x02);
    expect(sniffContainer(binary)).toBeNull();
  });

  it('rejects a payload with embedded NUL bytes as text', () => {
    const text = new TextEncoder().encode('hello world');
    const withNul = new Uint8Array(text.length + 1);
    withNul.set(text);
    withNul[text.length] = 0x00;
    expect(sniffContainer(withNul)).toBeNull();
  });

  it('matches container families against declared extensions', () => {
    expect(isExtensionConsistent('zip', 'docx')).toBe(true);
    expect(isExtensionConsistent('zip', 'xlsx')).toBe(true);
    expect(isExtensionConsistent('zip', 'png')).toBe(false);
    expect(isExtensionConsistent('jpeg', 'jpeg')).toBe(true);
    expect(isExtensionConsistent('jpeg', 'png')).toBe(false);
    expect(isExtensionConsistent('gzip', 'tgz')).toBe(true);
    expect(isExtensionConsistent('text', 'svg')).toBe(true);
  });
});
