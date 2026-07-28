import { describe, expect, it } from 'vitest';

import { resolveSampleRate } from '@/services/conversion/codecs/sample-rate';

/**
 * ffmpeg does not resample to fit an encoder — it exits. So a rate this helper
 * lets through unchanged is a failed conversion, not a quality compromise.
 */

describe('resolveSampleRate', () => {
  it('leaves unconstrained codecs alone', () => {
    expect(resolveSampleRate('libmp3lame', 44100)).toBe(44100);
    expect(resolveSampleRate('aac', 22050)).toBe(22050);
    expect(resolveSampleRate('flac', undefined)).toBeUndefined();
  });

  it('lifts 44.1 kHz to 48 kHz for libopus', () => {
    // The rate every CD-derived file carries, and the one libopus refuses.
    expect(resolveSampleRate('libopus', 44100)).toBe(48000);
  });

  it('never snaps downwards', () => {
    expect(resolveSampleRate('libopus', 22050)).toBe(24000);
    expect(resolveSampleRate('libopus', 32000)).toBe(48000);
    expect(resolveSampleRate('libopus', 9000)).toBe(12000);
  });

  it('keeps a rate the codec already supports', () => {
    expect(resolveSampleRate('libopus', 48000)).toBe(48000);
    expect(resolveSampleRate('libopus', 16000)).toBe(16000);
  });

  it('defaults a constrained codec to its highest rate', () => {
    expect(resolveSampleRate('libopus', undefined)).toBe(48000);
  });

  it('falls back to the highest rate above the ceiling', () => {
    expect(resolveSampleRate('libopus', 96000)).toBe(48000);
  });
});
