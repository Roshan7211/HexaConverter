import ffmpeg from 'fluent-ffmpeg';

import { ffmpegPath, ffprobePath } from '@/services/conversion/binaries';
import { resolveSampleRate } from '@/services/conversion/codecs/sample-rate';
import { getFormat } from '@/services/conversion/registry';
import { logger } from '@/lib/logger';
import { clamp } from '@/utils';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
  type MediaOptions,
} from '@/types/conversion';

/**
 * Audio and video transcoding through ffmpeg.
 *
 * Arguments are assembled programmatically from validated options — no user
 * string ever reaches a shell — and every run is bounded by a wall-clock
 * timeout plus an abort signal so a pathological input cannot pin a worker.
 */

let configured = false;

function configureFfmpeg() {
  if (configured) return;
  ffmpeg.setFfmpegPath(ffmpegPath());
  ffmpeg.setFfprobePath(ffprobePath());
  configured = true;
}

const MAX_DURATION_MS = 60 * 60 * 1000; // 1 hour of wall-clock per job

export interface MediaMetadata {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  bitrate: number | null;
}

export function probe(inputPath: string): Promise<MediaMetadata> {
  configureFfmpeg();

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (error, data) => {
      if (error) {
        reject(
          new ConversionError(
            'The media file could not be analysed. It may be corrupt or use an unsupported codec.',
            { cause: error },
          ),
        );
        return;
      }

      const video = data.streams.find(
        (stream) => stream.codec_type === 'video',
      );
      const audio = data.streams.find(
        (stream) => stream.codec_type === 'audio',
      );

      resolve({
        durationSeconds:
          typeof data.format.duration === 'number' &&
          Number.isFinite(data.format.duration)
            ? data.format.duration
            : null,
        width: video?.width ?? null,
        height: video?.height ?? null,
        videoCodec: video?.codec_name ?? null,
        audioCodec: audio?.codec_name ?? null,
        bitrate:
          typeof data.format.bit_rate === 'number'
            ? data.format.bit_rate
            : null,
      });
    });
  });
}

/** Container/codec configuration per target format. */
interface EncodeProfile {
  format: string;
  videoCodec?: string;
  audioCodec?: string;
  extraOutputOptions?: string[];
}

const PROFILES: Record<string, EncodeProfile> = {
  // Video containers
  mp4: {
    format: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    // `faststart` moves the moov atom to the front so playback can begin
    // before the whole file is downloaded.
    extraOutputOptions: ['-movflags', '+faststart', '-pix_fmt', 'yuv420p'],
  },
  mov: {
    format: 'mov',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    extraOutputOptions: ['-pix_fmt', 'yuv420p'],
  },
  mkv: {
    format: 'matroska',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    extraOutputOptions: ['-pix_fmt', 'yuv420p'],
  },
  webm: {
    format: 'webm',
    videoCodec: 'libvpx-vp9',
    audioCodec: 'libopus',
    extraOutputOptions: ['-deadline', 'good', '-cpu-used', '2', '-row-mt', '1'],
  },
  avi: { format: 'avi', videoCodec: 'mpeg4', audioCodec: 'libmp3lame' },

  // Audio containers
  mp3: { format: 'mp3', audioCodec: 'libmp3lame' },
  wav: { format: 'wav', audioCodec: 'pcm_s16le' },
  flac: { format: 'flac', audioCodec: 'flac' },
  ogg: { format: 'ogg', audioCodec: 'libvorbis' },
  opus: { format: 'opus', audioCodec: 'libopus' },
  aac: { format: 'adts', audioCodec: 'aac' },
  m4a: {
    format: 'ipod',
    audioCodec: 'aac',
    extraOutputOptions: ['-movflags', '+faststart'],
  },
};

function buildVideoFilters(
  options: MediaOptions,
  metadata: MediaMetadata,
): string[] {
  const filters: string[] = [];

  if (
    options.resolution &&
    metadata.height &&
    metadata.height > options.resolution
  ) {
    // `-2` keeps the width even, which H.264 and VP9 both require.
    filters.push(`scale=-2:${options.resolution}`);
  }
  if (options.fps) filters.push(`fps=${options.fps}`);

  return filters;
}

export const mediaEngine: ConversionEngine = {
  id: 'media',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    configureFfmpeg();

    const target = getFormat(context.targetFormat);
    if (!target) {
      throw new ConversionError(
        `Unsupported target format: ${context.targetFormat}`,
      );
    }

    const metadata = await probe(context.inputPath);
    context.onProgress(5);

    if (context.targetFormat === 'gif') {
      return runGif(context, metadata);
    }

    const profile = PROFILES[context.targetFormat];
    if (!profile) {
      throw new ConversionError(
        `Unsupported target format: ${context.targetFormat}`,
      );
    }

    const { options } = context;
    const audioOnly = target.category === 'audio';

    if (audioOnly && !metadata.audioCodec) {
      throw new ConversionError(
        'The uploaded file does not contain an audio track.',
      );
    }
    if (!audioOnly && !metadata.videoCodec && context.targetFormat !== 'gif') {
      throw new ConversionError(
        'The uploaded file does not contain a video track.',
      );
    }

    const command = ffmpeg(context.inputPath).format(profile.format);

    if (options.startSeconds) command.seekInput(options.startSeconds);
    if (options.durationSeconds) command.duration(options.durationSeconds);

    if (audioOnly) {
      command.noVideo();
    } else if (profile.videoCodec) {
      command.videoCodec(profile.videoCodec);

      const filters = buildVideoFilters(options, metadata);
      if (filters.length > 0) command.videoFilters(filters);

      if (options.videoBitrate) {
        command.videoBitrate(`${options.videoBitrate}k`);
      } else {
        const crf = clamp(options.crf ?? 23, 0, 51);
        command.outputOptions(
          profile.videoCodec === 'libvpx-vp9'
            ? ['-crf', String(crf), '-b:v', '0']
            : ['-crf', String(crf), '-preset', 'medium'],
        );
      }
    }

    if (profile.audioCodec && metadata.audioCodec) {
      command.audioCodec(profile.audioCodec);

      // Lossless targets must not be given a lossy bitrate.
      const lossless =
        profile.audioCodec === 'flac' || profile.audioCodec === 'pcm_s16le';
      if (!lossless) {
        command.audioBitrate(`${clamp(options.audioBitrate ?? 192, 32, 512)}k`);
      }
      const sampleRate = resolveSampleRate(
        profile.audioCodec,
        options.sampleRate,
      );
      if (sampleRate) command.audioFrequency(sampleRate);
      if (options.channels) command.audioChannels(options.channels);
      if (options.normalizeLoudness) {
        // EBU R128 normalisation to broadcast-standard loudness.
        command.audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11');
      }
    } else if (!profile.audioCodec) {
      command.noAudio();
    }

    if (profile.extraOutputOptions) {
      command.outputOptions(profile.extraOutputOptions);
    }

    await execute(command, context, metadata.durationSeconds);

    return { outputPath: context.outputPath, mime: target.mime };
  },
};

/**
 * Animated GIF export. A generated palette is required for acceptable colour
 * fidelity, produced in a single pass with `split`/`palettegen`/`paletteuse`.
 */
async function runGif(
  context: ConversionContext,
  metadata: MediaMetadata,
): Promise<ConversionOutcome> {
  const { options } = context;
  const fps = clamp(options.fps ?? 15, 1, 30);
  const height = options.resolution ?? 480;

  const scaleHeight = Math.min(height, metadata.height ?? height);

  // One-pass palette pipeline: the stream is split, a 256-colour palette is
  // generated from it, then applied to the frames.
  const filterGraph =
    `fps=${fps},scale=-1:${scaleHeight}:flags=lanczos,split[s0][s1];` +
    `[s0]palettegen=max_colors=256:stats_mode=diff[p];` +
    `[s1][p]paletteuse=dither=bayer:bayer_scale=5`;

  const command = ffmpeg(context.inputPath)
    .format('gif')
    .noAudio()
    .complexFilter(filterGraph);

  if (options.startSeconds) command.seekInput(options.startSeconds);
  // GIFs grow quickly; cap the exported span unless the user asked for less.
  command.duration(Math.min(options.durationSeconds ?? 30, 60));

  await execute(command, context, metadata.durationSeconds);

  return { outputPath: context.outputPath, mime: 'image/gif' };
}

function execute(
  command: ffmpeg.FfmpegCommand,
  context: ConversionContext,
  durationSeconds: number | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => {
      command.kill('SIGKILL');
      finish(
        new ConversionError(
          'The conversion exceeded the maximum allowed processing time.',
          { retryable: true },
        ),
      );
    }, MAX_DURATION_MS);

    const onAbort = () => {
      command.kill('SIGKILL');
      finish(new ConversionError('The conversion was cancelled.'));
    };
    context.signal.addEventListener('abort', onAbort, { once: true });

    let lastReported = 0;

    command
      .on('progress', (progress) => {
        let percent: number | null = null;

        if (durationSeconds && progress.timemark) {
          const elapsed = parseTimemark(progress.timemark);
          if (elapsed !== null) percent = (elapsed / durationSeconds) * 100;
        }
        if (percent === null && typeof progress.percent === 'number') {
          percent = progress.percent;
        }
        if (percent === null) return;

        // Map encoder progress onto 5–95 so the surrounding upload/finalise
        // steps still have room to report.
        const scaled = clamp(5 + (percent / 100) * 90, 5, 95);
        if (scaled - lastReported >= 1) {
          lastReported = scaled;
          context.onProgress(scaled);
        }
      })
      .on('error', (error: Error & { message: string }) => {
        if (/SIGKILL/i.test(error.message)) {
          // Already reported by the timeout or abort handler.
          finish(new ConversionError('The conversion was stopped.'));
          return;
        }
        logger.warn('ffmpeg failed', { message: error.message.slice(-1_500) });
        finish(
          new ConversionError(
            'The media file could not be converted. It may be corrupt, encrypted or use an unsupported codec.',
            { cause: error },
          ),
        );
      })
      .on('end', () => {
        context.onProgress(100);
        finish();
      })
      .save(context.outputPath);
  });
}

/** Parses an ffmpeg `HH:MM:SS.ms` timemark into seconds. */
function parseTimemark(timemark: string): number | null {
  const parts = timemark.split(':');
  if (parts.length !== 3) return null;

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}
