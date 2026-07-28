/**
 * Encoder sample-rate constraints.
 *
 * libopus is the reason this exists: it refuses 44.1 kHz outright — the rate
 * every CD-derived file carries — and ffmpeg exits with an error rather than
 * resampling, so any Opus or WebM output with an explicit sample rate fails
 * unless the rate is snapped first.
 */

/** Rates each encoder accepts, ascending. Unlisted codecs take any rate. */
const CODEC_SAMPLE_RATES: Record<string, readonly number[]> = {
  libopus: [8000, 12000, 16000, 24000, 48000],
};

/**
 * Snaps a requested sample rate to the nearest rate the encoder supports that
 * is not below the request, so audio is never silently downsampled. Returns
 * `undefined` for an unconstrained codec with no request, meaning "leave it to
 * ffmpeg".
 */
export function resolveSampleRate(
  codec: string,
  requested: number | undefined,
): number | undefined {
  const supported = CODEC_SAMPLE_RATES[codec];
  if (!supported) return requested;

  const highest = supported[supported.length - 1];
  if (!requested) return highest;

  return supported.find((rate) => rate >= requested) ?? highest;
}
