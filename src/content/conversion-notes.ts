import type { FormatSpec } from '@/types';
import type { FormatProfile } from '@/content/format-profiles';
import { findRoute } from '@/services/conversion/registry';

/**
 * What changes in one specific conversion.
 *
 * This is the only part of a `/tools/x-to-y` page that belongs to that page
 * alone. The format panels and the comparison table are per-format and repeat
 * across every route touching either side; the FAQ and the converter are
 * template. So everything a landing page is actually worth reading for is
 * decided here.
 *
 * Two rules govern what may be written:
 *
 *  1. Every note is derived from a real property of the two formats, or from
 *     what our own encoders genuinely do. If no rule matches, nothing is
 *     claimed — filler is worse than silence.
 *  2. Nothing is promised that the pipeline does not deliver. The media engine
 *     re-encodes every job and never stream-copies, so no note here may
 *     describe a conversion as a lossless repackage, however plausible that
 *     would sound for MOV to MP4.
 *
 * Lives outside the component so it can be tested directly:
 * `tests/unit/conversion-notes.test.ts` asserts a floor of substantive notes on
 * every published route, which is the guard against the long tail quietly
 * going thin again.
 */

export interface Note {
  heading: string;
  body: string;
}

/* -------------------------------------------------------------------------
 * Traits the format profiles do not carry
 *
 * `FormatProfile` describes a format on its own terms — what it is, what it is
 * good at. These tables describe how formats relate to each other and what our
 * encoders do with them, which is what a *pair* of formats needs.
 * ---------------------------------------------------------------------- */

/**
 * Lineage of the video containers.
 *
 * Container and codec are separate questions, and conflating them is the single
 * most common misunderstanding about video conversion. MP4's file structure was
 * derived from Apple's QuickTime format, so MOV and MP4 are close relatives;
 * WebM is a deliberately restricted profile of Matroska; AVI predates all of
 * them and is built on Microsoft's RIFF chunk layout.
 */
/**
 * Said once about a pair from the same lineage, rather than describing each
 * side in turn — which reads as circular when the two descriptions are each
 * other ("MOV is what MP4 came from, and MP4 came from MOV").
 */
const FAMILY_KINSHIP: Record<string, string> = {
  iso: "MP4's file structure was taken directly from QuickTime, which is the format MOV uses — they are close cousins rather than rivals.",
  matroska:
    'WebM is Matroska with the guest list shortened: the same underlying container design as MKV, restricted to a deliberately narrow set of codecs.',
};

const CONTAINER_FAMILY: Record<string, { family: string; label: string }> = {
  mp4: {
    family: 'iso',
    label: 'the ISO base media format, derived from QuickTime',
  },
  mov: {
    family: 'iso',
    label: "QuickTime, the format ISO's MP4 was derived from",
  },
  mkv: {
    family: 'matroska',
    label: 'Matroska, an open container that accepts almost any codec',
  },
  webm: {
    family: 'matroska',
    label: 'a deliberately narrow subset of Matroska',
  },
  avi: { family: 'riff', label: "RIFF, Microsoft's chunk format from 1992" },
};

/**
 * What our encoders actually produce for each target.
 *
 * Mirrors the `PROFILES` table in
 * `src/services/conversion/engines/media.engine.ts`. The engine cannot be
 * imported here — it pulls in ffmpeg bindings and would drag a server-only
 * dependency into a marketing component — so a unit test reads that file and
 * fails if the two ever disagree.
 */
interface EncodeFacts {
  /** Human name of the video codec written into the target, if any. */
  video?: string;
  /** Human name of the audio codec written into the target. */
  audio?: string;
  /** One clause on what is distinctive about how we write this target. */
  detail?: string;
  /** ffmpeg encoder names, so the drift test can compare the two files. */
  encoders: { video?: string; audio?: string };
}

export const ENCODES_AS: Record<string, EncodeFacts> = {
  mp4: {
    encoders: { video: 'libx264', audio: 'aac' },
    video: 'H.264',
    audio: 'AAC',
    detail:
      'the index is moved to the front of the file so it can start playing before it has finished downloading, and the colour is written as 8-bit 4:2:0, which is what phones, browsers and TVs all agree on. Quality is set by a constant-quality target rather than a fixed bitrate, so a still interview compresses small and a fast-moving clip is allowed the bits it needs',
  },
  mov: {
    encoders: { video: 'libx264', audio: 'aac' },
    video: 'H.264',
    audio: 'AAC',
    detail:
      'the same codecs an MP4 gets, in the QuickTime container Final Cut and older Apple tooling expect',
  },
  mkv: {
    encoders: { video: 'libx264', audio: 'aac' },
    video: 'H.264',
    audio: 'AAC',
    detail:
      'Matroska imposes no codec restrictions, so the choice here is for compatibility rather than because the container demands it. What Matroska adds is room — multiple audio tracks, subtitles and chapters all have a proper place in it, which is why it is the format of choice for archiving a film',
  },
  webm: {
    encoders: { video: 'libvpx-vp9', audio: 'libopus' },
    video: 'VP9',
    audio: 'Opus',
    detail:
      'both are royalty-free, which is the reason WebM exists — VP9 encodes considerably slower than H.264, so expect a longer wait than the same clip as MP4',
  },
  avi: {
    encoders: { video: 'mpeg4', audio: 'libmp3lame' },
    video: 'MPEG-4 Part 2',
    audio: 'MP3',
    detail:
      'the codecs AVI was built around, both roughly a generation behind what an MP4 would give you. The video is encoded at a constant quality target rather than a fixed bitrate, so the size of the result follows the complexity of the footage rather than being decided in advance',
  },
  mp3: {
    encoders: { audio: 'libmp3lame' },
    audio: 'MP3',
    detail:
      'written by LAME, the reference MP3 encoder, at 192 kbps by default. That sits comfortably above the point most people stop hearing a difference on ordinary equipment, and the bitrate is adjustable from 32 up to 320 if you want the file smaller or the quality nearer the source',
  },
  wav: {
    encoders: { audio: 'pcm_s16le' },
    audio: '16-bit PCM',
    detail:
      'as uncompressed 16-bit PCM, the format CDs use. There is no quality setting because nothing is being decided: every sample is stored literally. Expect around 10 MB per minute of stereo audio, which is the price of a format that every editor and every piece of hardware will open',
  },
  flac: {
    encoders: { audio: 'flac' },
    audio: 'FLAC',
    detail:
      'which is lossless, so there is no bitrate to set — the size is decided entirely by how compressible your audio turns out to be, usually landing near half of the equivalent WAV while preserving every sample exactly',
  },
  ogg: {
    encoders: { audio: 'libvorbis' },
    audio: 'Vorbis',
    detail:
      'at 192 kbps by default. Vorbis is royalty-free and holds up slightly better than MP3 at the same bitrate, though Opus has largely superseded it for anything new — choose OGG when something specifically expects it',
  },
  opus: {
    encoders: { audio: 'libopus' },
    audio: 'Opus',
    detail:
      'encoded with Vorbis at 192 kbps by default. Vorbis is royalty-free and holds up slightly better than MP3 at the same bitrate, though Opus has largely superseded it for new work',
  },
  aac: {
    encoders: { audio: 'aac' },
    audio: 'AAC',
    detail:
      'at 192 kbps, written as a raw ADTS stream rather than wrapped in a container. AAC is meaningfully better than MP3 at the same bitrate, which is why it became the default for streaming and broadcast. If you want tags and artwork to travel with it, choose M4A instead — the same audio in a container that has somewhere to put them',
  },
  m4a: {
    encoders: { audio: 'aac' },
    audio: 'AAC',
    detail:
      'the same codec a bare .aac file holds, wrapped in an MP4 container so that artwork and tags have somewhere to live',
  },
};

/**
 * How our image encoders are configured.
 *
 * Mirrors the `switch (targetFormat)` block in
 * `src/services/conversion/engines/image.engine.ts`. Same arrangement as
 * `ENCODES_AS`, and covered by the same drift test.
 */
const IMAGE_ENCODER: Record<string, string> = {
  jpg: 'quality 82 through mozjpeg, written progressively so it renders in passes over a slow connection',
  png: 'maximum compression with adaptive filtering, and fully lossless — lowering the quality dial is what switches PNG to a 256-colour palette, and it is at 100 unless you move it',
  webp: 'quality 82, with the encoder choosing colour subsampling per image rather than applying it blindly',
  avif: "quality 60 — the scale is not comparable with JPEG's, and 60 here is a visually higher setting than the number suggests",
  tiff: 'quality 90 with LZW compression, which every print and scanning tool reads',
  gif: 'a high effort setting on the palette search, which is where GIF quality is won or lost',
  bmp: 'stored as plain uncompressed pixels, since that is essentially all BMP offers',
};

/** Formats that routinely arrive carrying camera metadata. */
const CARRIES_EXIF = new Set(['jpg', 'heic', 'tiff', 'png', 'webp', 'avif']);

/** Targets whose colour resolution is halved by 4:2:0 chroma subsampling. */
const SUBSAMPLED_TARGETS = new Set(['jpg', 'avif']);

/** How each archive format stores what it holds. */
const ARCHIVE_TRAITS: Record<
  string,
  { compression: string; access: string; keepsPermissions: boolean }
> = {
  zip: {
    compression: 'compresses each file separately with deflate',
    access: 'any single file can be read without touching the rest',
    keepsPermissions: false,
  },
  tar: {
    compression: 'applies no compression whatsoever — it only concatenates',
    access: 'reading one file means reading through everything before it',
    keepsPermissions: true,
  },
  tgz: {
    compression:
      'concatenates with tar, then compresses the whole stream in one pass',
    access: 'reading one file means decompressing everything before it',
    keepsPermissions: true,
  },
  '7z': {
    compression: 'compresses with LZMA, usually the tightest of these formats',
    access: 'supports random access, though at a higher cost to decompress',
    keepsPermissions: false,
  },
  rar: {
    compression: 'uses a proprietary algorithm no open tool may write',
    access: 'random access within the archive',
    keepsPermissions: false,
  },
  gz: {
    compression:
      'compresses a single stream and has no concept of multiple files',
    access: 'must be decompressed from the start',
    keepsPermissions: false,
  },
};

/** Office formats and what a conversion through LibreOffice costs each one. */
const OFFICE_SOURCES = new Set([
  'docx',
  'doc',
  'odt',
  'rtf',
  'xlsx',
  'xls',
  'ods',
  'pptx',
  'ppt',
  'odp',
]);
const SLIDE_SOURCES = new Set(['pptx', 'ppt', 'odp']);
const SHEET_SOURCES = new Set(['xlsx', 'xls', 'ods']);
const LEGACY_OFFICE = new Set(['doc', 'xls', 'ppt']);

const AUDIO_TAG_FAMILY: Record<string, string> = {
  mp3: 'ID3',
  aac: 'ID3',
  flac: 'Vorbis comments',
  ogg: 'Vorbis comments',
  opus: 'Vorbis comments',
  m4a: 'MP4 atoms',
  wav: 'RIFF INFO chunks, which many players ignore entirely',
};

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

/**
 * Compression behaviour for reasoning about a pair.
 *
 * `FormatProfile.kind` describes the file, and for wrappers that is `container`
 * — true of M4A, but useless here, because an M4A's audio is lossy AAC and a
 * page about MP3 to M4A has to be able to say so. Only the audio containers are
 * resolved: a video container genuinely holds anything, and a spreadsheet
 * container is not on this axis at all.
 */
function effectiveKind(
  spec: FormatSpec,
  profile: FormatProfile,
): FormatProfile['kind'] {
  if (spec.id === 'm4a') return 'lossy';
  return profile.kind;
}

const isLossy = (kind: FormatProfile['kind']) => kind === 'lossy';
const isExact = (kind: FormatProfile['kind']) =>
  kind === 'lossless' || kind === 'uncompressed';

/** Names the codecs a target is written with, as a sentence fragment. */
function encodedAs(id: string): string | null {
  const facts = ENCODES_AS[id];
  if (!facts) return null;
  if (facts.video && facts.audio)
    return `${facts.video} video with ${facts.audio} audio`;
  if (facts.audio) return `${facts.audio}`;
  return null;
}

/* -------------------------------------------------------------------------
 * Rule families
 * ---------------------------------------------------------------------- */

/**
 * Pixel formats: what the image loses on the way across.
 *
 * Ordered by how much it can surprise someone — silent data loss first, size
 * and fidelity after.
 */
function imageNotes(
  from: FormatSpec,
  to: FormatSpec,
  fromProfile: FormatProfile,
  toProfile: FormatProfile,
  notes: Note[],
) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();

  // Transparency is the one that catches people out, because the damage is
  // invisible until the image sits on a coloured background.
  if (from.supportsAlpha && !to.supportsAlpha) {
    notes.push({
      heading: 'Transparency is flattened',
      body: `${F} carries an alpha channel and ${T} has none, so anything transparent has to become a solid colour. We composite onto white. If the image was designed to sit over a coloured background, convert to a format that keeps alpha instead — or expect a white box around it.`,
    });
  }

  if (fromProfile.kind === 'vector' && to.category === 'image') {
    notes.push({
      heading: 'Scalability is lost here',
      body: `${F} describes shapes, so it is sharp at any size. ${T} is a fixed grid of pixels. Once converted, enlarging the result will blur it — so choose the output size before converting, not after, and pick the largest size you will ever need.`,
    });
  }

  if (toProfile.kind === 'vector' && from.category === 'image') {
    notes.push({
      heading: 'This does not trace your image',
      body: `Converting pixels to ${T} does not turn a photograph into editable shapes — real vectorisation is a different job with different results. The image is embedded in the ${T} wrapper, so it stays a bitmap and will not gain the scalability ${T} is usually chosen for.`,
    });
  }

  const fromAnimates = fromProfile.animation.startsWith('Yes');
  const toAnimates = toProfile.animation.startsWith('Yes');

  // Both sides must be still-image formats for this to be true. Checking only
  // that the target does not animate was wrong: video targets report animation
  // as not applicable, so GIF to MP4 claimed to drop every frame but the first
  // when keeping the motion is the entire reason for that conversion.
  if (
    fromAnimates &&
    !toAnimates &&
    from.category === 'image' &&
    to.category === 'image' &&
    fromProfile.kind !== 'vector'
  ) {
    notes.push({
      heading: 'Only the first frame survives',
      body:
        from.id === 'gif'
          ? `A GIF is usually an animation, and ${T} holds a single still image — so the result is the first frame and the rest is discarded. To keep the motion, convert to a video format instead, or to a still format that animates.`
          : `Most ${F} files are still images and convert straightforwardly. ${F} can also hold an animation, though, and ${T} cannot: if yours is animated, what you get back is its first frame and nothing else. Convert to a video format, or to another animating image format, if the motion matters.`,
    });
  }

  if (from.id === 'gif' && to.category === 'image' && to.id !== 'gif') {
    notes.push({
      heading: 'The palette does not grow',
      body: `A GIF holds at most 256 colours per frame, and ${T} can hold millions — but the colours your GIF discarded when it was made do not come back. Any banding you can see in the ${F} will still be there afterwards, stored in a format capable of much more.`,
    });
  }

  if (to.id === 'gif' && from.category === 'image' && from.id !== 'gif') {
    notes.push({
      heading: 'Down to 256 colours',
      body: `GIF stores a palette of at most 256 colours per frame. A photograph converted from ${F} has to be reduced to fit, which shows as banding across skies, skin and gradients. For a still image this is almost never the right format — ${T} is worth choosing only when something must animate everywhere without a video player.`,
    });
  }

  if (from.id === 'heic' && to.category === 'image') {
    notes.push({
      heading: 'Why this conversion exists',
      body: `HEIC is what an iPhone saves by default, and almost nothing outside Apple's ecosystem opens it — which is why most people arrive here. ${T} trades HEIC's efficiency for the ability to open the file anywhere. Depth maps, Live Photo motion and any other auxiliary data in the HEIC are not carried across; what you get is the photograph itself.`,
    });
  }

  if (
    from.category === 'image' &&
    to.category === 'document' &&
    to.id === 'pdf'
  ) {
    notes.push({
      heading: 'The image is placed, not read',
      body: `Your ${F} is embedded on a PDF page as a picture. Any text visible in the image stays part of the picture and is not searchable. To make it selectable, run text recognition on the resulting PDF afterwards.`,
    });
  }

  // Stated as a property of the formats rather than a promise about how many
  // files come back, which depends on the source and is not ours to guarantee.
  if (from.id === 'tiff' && to.category === 'image' && to.id !== 'tiff') {
    notes.push({
      heading: 'TIFF can hold more than one page',
      body: `A single ${F} may contain several pages, and a ${T} holds exactly one image. A multi-page ${F} therefore cannot be represented as one ${T} — each page needs a file of its own.`,
    });
  }

  // WebP and AVIF can go either way, so the outcome is set by the quality
  // control rather than by the format.
  if (toProfile.kind === 'either' && from.category === 'image') {
    notes.push({
      heading: 'You choose how much to keep',
      body: `${T} can compress either lossily or losslessly, so the quality setting decides the outcome rather than the format. High quality stays close to the ${F} you started with; lower settings trade visible detail for a much smaller file.`,
    });
  }

  if (to.id === 'bmp' && from.category === 'image') {
    notes.push({
      heading: 'Expect a very large file',
      body: `BMP generally stores every pixel with no compression at all, so the result is often several times the size of the ${F} it came from while looking exactly the same. It is worth choosing only for old Windows software that will not read anything else.`,
    });
  }

  if (to.id === 'avif' && from.category === 'image') {
    notes.push({
      heading: 'Encoding takes longer',
      body: `AVIF comes from the AV1 video codec, and that compression is slow — noticeably slower than writing a JPEG or a PNG. The payoff is the smallest file of any format here at a comparable quality. Check your audience first: browsers handle AVIF well now, but plenty of desktop and print software still will not open it.`,
    });
  }
}

/**
 * What our image pipeline does to the file, as opposed to what the formats are.
 *
 * Only fires for routes the image engine actually handles — image to PDF goes
 * through the document engine and none of this applies to it.
 */
function imagePipelineNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  if (from.category !== 'image' || to.category !== 'image') return;

  if (CARRIES_EXIF.has(from.id)) {
    notes.push({
      heading: 'Camera data is removed by default',
      body: `A ${F} straight from a phone or camera carries EXIF metadata — model, settings, timestamp and, quite often, the GPS coordinates of where the photo was taken. The converted ${T} is written without it, so a file you are about to share does not quietly carry your location. The orientation flag is read and applied to the pixels first, so the image will not come out sideways once the tag holding it is gone. If you need the metadata kept, there is a setting for it.`,
    });
  }

  const encoder = IMAGE_ENCODER[to.id];
  if (encoder) {
    notes.push({
      heading: `How the ${T} is written`,
      body: `Our default is ${encoder}. The quality control on the converter moves this if you need to — the default aims to be indistinguishable from the source at a sensible file size, rather than to win a compression benchmark.`,
    });
  }

  if (SUBSAMPLED_TARGETS.has(to.id) && !SUBSAMPLED_TARGETS.has(from.id)) {
    notes.push({
      heading: 'Colour detail is stored at half resolution',
      body: `${T} keeps full brightness detail but records colour at half resolution in each direction, because the eye is far more sensitive to the first than the second. On photographs it is invisible. On saturated edges it is not: red text on white, thin coloured lines and flat graphic shapes can pick up fringing. If the ${F} is a screenshot, a logo or anything with text in it, a lossless format will treat it far better.`,
    });
  }
}

/**
 * Audio and video.
 *
 * Grounded in what `media.engine.ts` genuinely does, which is re-encode every
 * job. Nothing here may suggest a repackage.
 */
function mediaNotes(
  from: FormatSpec,
  to: FormatSpec,
  fromProfile: FormatProfile,
  toProfile: FormatProfile,
  notes: Note[],
) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  const fk = effectiveKind(from, fromProfile);
  const tk = effectiveKind(to, toProfile);
  const medium =
    from.category === 'audio' || to.category === 'audio'
      ? 'audible'
      : 'visible';

  // The most consequential thing about a cross-category media conversion.
  if (from.category === 'video' && to.category === 'audio') {
    notes.push({
      heading: 'Only the sound is kept',
      body: `This takes the audio track out of the ${F} and writes it as ${T}. The picture is discarded entirely, and no conversion back will return it — keep the ${F} if you still need the video.`,
    });
  }

  if (from.category === 'video' && to.category === 'video') {
    const a = CONTAINER_FAMILY[from.id];
    const b = CONTAINER_FAMILY[to.id];
    if (a && b) {
      notes.push({
        heading:
          a.family === b.family
            ? `${F} and ${T} are close relatives`
            : `${F} and ${T} are unrelated containers`,
        body:
          a.family === b.family
            ? `${FAMILY_KINSHIP[a.family]} That is why the same player usually opens both, and it is worth knowing generally: the extension on a video tells you far less about it than the codec stored inside does.`
            : `${F} is built on ${a.label}. ${T} is ${b.label}. A container is a box, not a compression method: what decides how a video looks and how large it is, is the codec stored inside, and these two boxes accept different ones.`,
      });
    }
  }

  // Said plainly because it is the honest answer to "why is this not instant?".
  if (
    (from.category === 'video' || from.category === 'audio') &&
    (to.category === 'video' || to.category === 'audio')
  ) {
    notes.push({
      heading: 'This is a re-encode, not a repackage',
      body: `Some tools can move a stream into a different container untouched when the codecs happen to line up. We do not — every job here is decoded and encoded again, so the conversion takes time in proportion to the length of the file and costs a small amount of quality even where a repackage would have been possible. In exchange the output is predictable: it plays everywhere, rather than inheriting whatever the source happened to contain.`,
    });
  }

  const becomes = encodedAs(to.id);
  if (becomes && (to.category === 'video' || to.category === 'audio')) {
    const facts = ENCODES_AS[to.id]!;
    notes.push({
      heading: `What your ${T} will contain`,
      body: `The output is ${becomes}${facts.detail ? ` — ${facts.detail}` : ''}.`,
    });
  }

  if (to.id === 'avi' && from.category === 'video') {
    notes.push({
      heading: 'AVI costs you size and quality',
      body: `MPEG-4 Part 2 is roughly a generation behind H.264, so an AVI will usually be larger than an MP4 of the same clip at the same quality — not smaller. AVI also has no proper support for chapters, subtitles or modern metadata. Convert to it when a piece of old software or hardware will read nothing else, not for quality, size or convenience.`,
    });
  }

  // Compression chain, worded for the ear rather than the eye.
  if (isLossy(fk) && isExact(tk)) {
    notes.push({
      heading: 'Quality cannot come back',
      body: `${F} already discarded detail permanently, and ${T} stores exactly what it is given. The result will be considerably larger while sounding identical to the ${F} you started from — lossless preserves, it does not restore. That is still the right move if you are about to edit, because further saves will not degrade it again.`,
    });
  }

  if (isExact(fk) && isLossy(tk)) {
    notes.push({
      heading: 'This step is irreversible',
      body: `${F} holds every sample; ${T} keeps a close approximation. The file gets dramatically smaller, and converting back later will not undo it. Keep the ${F} original if it is a master you will work from again.`,
    });
  }

  if (isLossy(fk) && isLossy(tk)) {
    notes.push({
      heading: 'Re-encoding costs a little quality',
      body: `Both formats are lossy, so this decodes ${F} and compresses again as ${T}. That second pass loses a small amount on top of what was already gone. It is barely ${medium} once, and it accumulates if a file is converted repeatedly — so convert from the original rather than from a previous conversion.`,
    });
  }

  if (
    isExact(fk) &&
    isExact(tk) &&
    (from.category === 'audio' || to.category === 'audio')
  ) {
    notes.push({
      heading: 'Nothing is lost in this step',
      body: `${F} and ${T} both store every sample exactly, so this changes the container and the file size rather than the audio itself. Convert freely and as often as you like — the waveform that comes out is the waveform that went in.`,
    });
  }

  // Tags travel badly between families, and losing artwork surprises people.
  const fromTags = AUDIO_TAG_FAMILY[from.id];
  const toTags = AUDIO_TAG_FAMILY[to.id];
  if (fromTags && toTags && fromTags !== toTags) {
    notes.push({
      heading: 'Tags may not survive intact',
      body: `${F} stores its metadata as ${fromTags}, and ${T} uses ${toTags}. Standard fields such as title, artist and album normally map across. Anything without an equivalent on the other side — unusual custom fields, some ratings and play counts, occasionally embedded artwork — has nowhere to go. Check the tags before deleting the original if your library depends on them.`,
    });
  }

  if (from.id === 'gif' && to.category === 'video') {
    notes.push({
      heading: 'A far smaller file, the same 256 colours',
      body: `Video compression is enormously better suited to motion than GIF is, so the ${T} will typically be a fraction of the size. What it will not be is more colourful: the palette was reduced when the GIF was made, and the banding is already baked into the frames. The result also gains an audio track it has nothing to put in, and will not autoplay silently everywhere a GIF does.`,
    });
  }

  if (
    from.category === 'video' &&
    to.category === 'image' &&
    toProfile.animation.startsWith('Yes')
  ) {
    notes.push({
      heading: 'A video becomes an animation',
      body: `The motion survives, but ${T} is a far blunter instrument than video: it has no sound, and its 256-colour palette shows as banding on anything filmed. Expect the result to be larger than the ${F} it came from, despite looking worse — which is why short clips work and long ones do not.`,
    });
  }
}

/**
 * Word processor, spreadsheet and presentation formats.
 *
 * Everything in this family passes through headless LibreOffice, and the
 * consequences of that are worth stating rather than hiding.
 */
function officeNotes(
  from: FormatSpec,
  to: FormatSpec,
  engine: string | null,
  notes: Note[],
) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  if (!OFFICE_SOURCES.has(from.id)) return;

  if (to.id === 'pdf') {
    notes.push({
      heading: 'It stops being editable',
      body: `A ${F} is a document that reflows — text finds its own line breaks depending on the fonts and page size available. A PDF fixes every glyph in place. That is exactly why PDF is the format you send someone, and exactly why it is the wrong format to keep working in. Hold on to the ${F} as your editable master.`,
    });
  }

  if (engine === 'office') {
    notes.push({
      heading: 'Rendered by LibreOffice',
      body: `The conversion runs through headless LibreOffice — the same engine behind the desktop suite, not a lookalike parser. It handles ordinary documents faithfully. Where it can drift is on the elaborate: a document leaning on fonts the server does not have will have them substituted, and the substitute rarely occupies exactly the same width, so line and page breaks can move. Heavily designed layouts are worth checking against the original.`,
    });
  }

  if (SLIDE_SOURCES.has(from.id) && to.id === 'pdf') {
    notes.push({
      heading: 'One slide per page, and no motion',
      body: `Each slide becomes a page. Transitions, builds and animations have no representation in a PDF, so anything that appeared on a click is rendered in its final state — which means an overlapping build can print as overlapping text. Speaker notes are not included in the pages.`,
    });
  }

  if (SHEET_SOURCES.has(from.id) && to.id === 'pdf') {
    notes.push({
      heading: 'Paginated by the print area',
      body: `A spreadsheet has no natural page size, so the PDF is broken up according to the print settings saved in the ${F}. A wide sheet without a set print area will spill across pages in a way that rarely reads well. Set the print area, scaling and orientation in the spreadsheet first — the conversion honours those settings rather than guessing.`,
    });
  }

  if (to.id === 'rtf') {
    notes.push({
      heading: 'RTF carries less than it looks like it does',
      body: `Rich Text Format dates from 1987 and exists so that any word processor can open a file with its formatting broadly intact. Bold, italics, fonts and simple tables survive. Modern structure does not: tracked changes, comments, footnotes in some layouts and anything embedded tend to be dropped or flattened. Choose it for interchange with something old, not as a working format.`,
    });
  }

  if (to.id === 'html') {
    notes.push({
      heading: 'Approximated as a web page',
      body: `A ${F} describes fixed pages; HTML describes a document that reflows to whatever window it lands in. The converter maps the styling onto CSS as closely as it can, but there is no page concept on the other side — headers, footers and page numbering have nowhere to go, and precise positioning becomes approximate. Expect a readable document rather than a pixel-accurate copy.`,
    });
  }

  if (LEGACY_OFFICE.has(from.id)) {
    notes.push({
      heading: `${F} is the pre-2007 binary format`,
      body: `Microsoft replaced ${F} with its XML-based successor in Office 2007, and support has been quietly eroding since — recent versions of Office block these files by default on security grounds, because the old binary format can carry macros in ways that are hard to inspect. Converting is usually the right move for anything you intend to keep. Macros are not carried across.`,
    });
  }

  if (LEGACY_OFFICE.has(to.id)) {
    notes.push({
      heading: `${T} is a legacy target`,
      body: `${T} is the pre-2007 binary format, superseded nearly two decades ago and increasingly refused outright by modern software. It is worth producing only when something genuinely old has to read the file. If the recipient is on any current version of Office, the XML-based format will open more reliably than this will.`,
    });
  }

  if (
    from.id !== to.id &&
    OFFICE_SOURCES.has(to.id) &&
    !LEGACY_OFFICE.has(to.id) &&
    to.id !== 'rtf'
  ) {
    notes.push({
      heading: 'Two suites, two ideas of the same document',
      body: `${F} and ${T} are the native formats of different office suites, and they do not model documents identically. The text, structure and ordinary formatting come across cleanly. The margins are where care is needed: macros do not transfer, tracked changes and comments can be flattened, and features with no counterpart on the other side are approximated. Read the result before sending it on.`,
    });
  }
}

/** CSV, JSON and workbooks: the shape of the data, not its appearance. */
function dataNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();

  if (['xlsx', 'xls', 'ods'].includes(from.id) && to.id === 'csv') {
    notes.push({
      heading: `One sheet of your ${F}, values only`,
      body: `A ${F} can hold many sheets; a CSV is a single table of plain values. Formulas are replaced by the results they had calculated, and formatting, charts and any additional sheets have nowhere to go in the format. It travels everywhere in exchange for holding a good deal less.`,
    });
  }

  if (from.id === 'csv' && (to.id === 'xlsx' || to.id === 'ods')) {
    notes.push({
      heading: 'Your text acquires types',
      body: `A CSV is text: every field is a string, and nothing in the file says otherwise. A spreadsheet has real types, so opening one means guessing which columns are numbers and which are dates. That guess is where data gets damaged — a product code of 00123 can arrive as the number 123, a long identifier can be rewritten in scientific notation, and 03/04 is a date whose meaning depends on where the reader thinks it is from. Check any column of codes, identifiers or part numbers before you rely on the result.`,
    });
    notes.push({
      heading: 'It becomes a real workbook',
      body: `The output is a genuine ${T} rather than a CSV with a new extension: the first row is treated as a header, set in bold and frozen so it stays visible while scrolling, and column widths are set from the header text. From there it behaves like any other workbook — formulas, additional sheets and formatting all become available.`,
    });
  }

  if (from.id === 'json' && (to.id === 'csv' || to.id === 'xlsx')) {
    notes.push({
      heading: 'Nesting has to be flattened',
      body: `JSON holds trees — objects inside arrays inside objects — and a table has rows and columns and nothing else. An array of flat records converts cleanly, with the keys becoming the header row. Anything deeper has to be serialised back into a single cell, because a table has no way to express it. If your data nests, decide which level of it is the row before converting.`,
    });
  }

  if ((from.id === 'csv' || from.id === 'xlsx') && to.id === 'json') {
    notes.push({
      heading: 'Rows become records',
      body: `The first row is read as field names, and every row after it becomes one object keyed by those names. That gives you the array of records most APIs and scripts expect. A sheet whose real header does not sit in the first row will produce field names taken from whatever does — worth checking before you point code at the output.`,
    });
  }

  if (from.id === 'csv' && to.id === 'json') {
    notes.push({
      heading: 'Types are inferred, not declared',
      body: `JSON distinguishes the number 42 from the string "42"; a CSV cannot. Values that read as numbers are written as numbers, and everything else stays a string. Where that guess matters to you — identifiers with leading zeros, telephone numbers, anything you never want arithmetic performed on — check those fields in the result.`,
    });
  }
}

/** Repackaging one archive as another. */
function archiveNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  if (from.category !== 'archive' || to.category !== 'archive') return;

  const a = ARCHIVE_TRAITS[from.id];
  const b = ARCHIVE_TRAITS[to.id];

  notes.push({
    heading: 'The archive is rebuilt, not renamed',
    body: `Your ${F} is unpacked in full and its contents are written into a new ${T}. Nothing is passed through untouched, so the compression is done again from scratch at the level you choose, and the resulting size depends on that setting rather than on how the ${F} was originally made. The folder structure inside is preserved exactly.`,
  });

  if (a && b) {
    notes.push({
      heading: 'These two store files differently',
      body: `${F} ${a.compression}, so ${a.access}. ${T} ${b.compression}, so ${b.access}. That difference is the real reason to pick one over the other: per-file compression lets a tool pull out a single entry cheaply, while compressing everything as one stream finds patterns across files and usually ends up smaller.`,
    });
  }

  if (a && b && a.keepsPermissions !== b.keepsPermissions) {
    notes.push({
      heading: b.keepsPermissions
        ? 'Unix file modes have somewhere to go'
        : 'Unix file modes do not travel',
      body: b.keepsPermissions
        ? `${T} records Unix permissions and symbolic links as a matter of course, which is why it is the format of choice for anything destined for a server. Note that it can only record what it is given: metadata the ${F} never stored cannot be recovered by converting.`
        : `${F} can record Unix permissions and symbolic links; ${T} has no dependable place to put them. Executable bits in particular are the thing that goes missing — a script that ran before extraction may need its permissions set again afterwards. If the archive is destined for a server, a tar-based format is the safer choice.`,
    });
  }

  if (from.id === 'rar' || from.id === '7z' || from.id === 'gz') {
    notes.push({
      heading: `Why ${F} is read-only here`,
      body:
        from.id === 'rar'
          ? `RAR's compression is proprietary: it may be read freely but not written by open tools, so we can unpack a RAR and give you the contents in an open format, and cannot produce one. That is a licensing boundary rather than a technical one.`
          : from.id === 'gz'
            ? `Plain gzip compresses a single stream and has no concept of files or folders — which is why it is nearly always paired with tar. We accept it as a source and write open multi-file formats instead.`
            : `7z compresses tightly, but writing it well requires the reference implementation. We read it and repackage the contents into formats every operating system can open without extra software.`,
    });
  }

  notes.push({
    heading: 'You choose how hard it compresses',
    body: `Because the archive is built again from scratch, the compression level is yours to set rather than inherited from the ${F}. It defaults to 6 — the setting that has been the sensible middle ground for deflate for thirty years. Raising it buys a few percent for a disproportionate amount of time; lowering it is worth doing for large archives of already-compressed material such as photographs or video, where there is nothing left to squeeze.`,
  });

  if (to.id === 'tar') {
    notes.push({
      heading: 'TAR does not compress at all',
      body: `A tar file only concatenates — it makes one file out of many and applies no compression whatsoever, so the result will be roughly the combined size of everything inside it. That is deliberate: tar handles the bundling and a separate compressor handles the squeezing. If you want the file smaller, TGZ is the same tar with gzip applied over it.`,
    });
  }
}

/** Plain text, markup and PDF extraction. */
function documentNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();

  if (from.category === 'document' && to.category === 'image') {
    notes.push({
      heading: 'Pages become separate images',
      body: `A ${F} can run to many pages, while each ${T} holds one image. Every page is rendered separately, so a ten-page document produces ten files. Text stops being text at that point — it becomes pixels, no longer selectable or searchable.`,
    });
    notes.push({
      heading: 'Resolution is decided now',
      body: `A ${F} stores text as instructions for drawing letters at any size. Rendering to ${T} freezes that into a fixed grid of pixels, so the resolution you choose is the resolution you are stuck with — enlarging afterwards only blurs it. Pick a higher setting than you think you need if the result will be printed or zoomed into.`,
    });
  }

  if (from.id === 'pdf' && to.id === 'txt') {
    notes.push({
      heading: 'Scanned PDFs have no text to extract',
      body: `This pulls out the text a PDF genuinely contains. A PDF produced from a scanner or a photograph contains images of words rather than words, and there is nothing in the file to extract — the result comes back empty or nearly so. That is not a failure of the conversion; it means the document needs text recognition run over it first.`,
    });
    notes.push({
      heading: 'Reading order is not always the visual order',
      body: `A PDF positions each run of text on the page and does not record which column or paragraph it belonged to. Extraction follows the order the text was written into the file, which for a single-column document matches what you see. Multi-column layouts, sidebars and tables can come out interleaved, because the file itself never said where one column ended.`,
    });
  }

  if (from.id === 'pdf' && to.id === 'docx') {
    notes.push({
      heading: 'The document is reconstructed, not recovered',
      body: `A PDF has no paragraphs, no styles and no tables — only glyphs at coordinates. Producing a DOCX means inferring all of that back from position, and the inference is good rather than perfect. Expect the text to be right and the structure to need tidying: paragraph breaks in the wrong place, tables that come across as text, spacing achieved with returns rather than styles.`,
    });
  }

  if (to.id === 'txt' && from.category === 'document' && from.id !== 'txt') {
    notes.push({
      heading: 'Only the words survive',
      body: `${T} stores characters and nothing else, so fonts, sizes, colours, images, tables and page layout are all dropped. What you get back is the text itself — which is the point when you want the content free of the formatting around it.`,
    });
  }

  if (from.id === 'md' && to.id === 'html') {
    notes.push({
      heading: 'Markers become real markup',
      body: `The hashes, asterisks and brackets in Markdown are shorthand. This turns them into the elements they stand for — headings, emphasis, lists, links and code blocks — producing a document a browser understands structurally rather than as decorated text. What it does not add is styling: the output carries structure, and how it looks is for CSS to decide.`,
    });
  }

  if (from.id === 'md' && to.id === 'txt') {
    notes.push({
      heading: 'The shorthand is stripped',
      body: `Markdown is already readable as plain text, so this is a gentle conversion: the syntax that marked up headings, emphasis and links is removed, and the words are left. Links lose their destinations, since a text file has nowhere to keep them — if the URLs matter, convert to HTML instead.`,
    });
  }

  if (from.id === 'html' && to.id === 'txt') {
    notes.push({
      heading: 'Structure flattens to a stream of words',
      body: `Tags are removed and the text inside them is kept, so headings, list items and paragraphs all arrive as ordinary lines. Anything carried by an attribute rather than by the text — link destinations, image sources, alt text — is gone, and content generated by scripts was never in the file to begin with.`,
    });
  }

  if (from.id === 'txt' && (to.id === 'pdf' || to.id === 'html')) {
    notes.push({
      heading: 'Layout has to be invented',
      body: `A text file carries no formatting at all, so the converter supplies what ${T} requires: a readable typeface, sensible margins${to.id === 'pdf' ? ' and page breaks where the text runs past the bottom of a page' : ' and paragraph structure'}. Any alignment achieved with spaces or tabs in the original will shift, because a proportional typeface does not put characters on a fixed grid.`,
    });
  }
}

/**
 * Placing an image into a PDF page.
 *
 * Handled by the document engine rather than the image engine, so none of the
 * image pipeline notes apply — this is a different code path with different
 * consequences, and the size one surprises people.
 */
function imageToPdfNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  if (from.category !== 'image' || to.id !== 'pdf') return;

  notes.push({
    heading: 'Centred on a page, never enlarged',
    body: `The image is placed on an A4 page by default with a 10 mm margin, scaled down to fit and centred. It is never scaled up: a small ${F} stays its own size in the middle of the page rather than being stretched to fill it, because upscaling would only make it blurry. Page size, orientation and margin are all adjustable before you convert.`,
  });

  notes.push({
    heading: 'The PDF can be larger than the image',
    body: `The picture is embedded losslessly, so nothing is degraded on the way in — but a ${F} that was already efficiently compressed does not stay that size once it is stored this way, and the PDF wrapper adds its own overhead on top. Converting an image to PDF is a way of making it printable and easy to send, not a way of making it smaller.`,
  });
}

/** SVG is not pixels until something decides how many. */
function vectorRasterNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const T = to.id.toUpperCase();
  if (from.id !== 'svg' || to.category !== 'image') return;

  notes.push({
    heading: 'Something has to choose the size',
    body: `An SVG has no pixel dimensions of its own — it is a description of shapes that can be drawn at any scale. Rendering it to ${T} means picking one. We use the size declared in the file, and fall back to 1024 pixels wide when it declares none. Set the width explicitly if the result is destined for print or a high-density screen.`,
  });

  notes.push({
    heading: 'Fonts and linked files are not fetched',
    body: `An SVG that names a font it does not embed relies on the renderer having that font, and an SVG that links to an external image relies on that link resolving. Neither is fetched from the network during conversion — for safety, since it would mean a converted file could make requests on your behalf. If the artwork depends on either, convert the text to outlines and embed the images before uploading.`,
  });
}

/** Plain text and markup share a set of concerns about encoding and structure. */
function textPipelineNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const TEXTY = new Set(['txt', 'md', 'html', 'csv', 'json']);
  // Encoding is a property of the source alone, so this applies whatever the
  // file is being converted into — including the office targets.
  if (!TEXTY.has(from.id)) return;

  notes.push({
    heading: 'Read as UTF-8',
    body: `A ${F} is a text file, and a text file does not record which encoding it uses — that is the one thing the format cannot tell you about itself. We read it as UTF-8, which is right for essentially anything produced this decade. A file saved long ago in a regional encoding can arrive with accented characters mangled, and the fix is to re-save it as UTF-8 before converting rather than after. Tabs and spaces used to line columns up will also shift once the text is set in a proportional typeface.`,
  });

  if (to.id === 'html') {
    notes.push({
      heading: 'The markup is sanitised',
      body: `The HTML we produce is filtered down to a safe set of elements and attributes: scripts, event handlers and embedded objects are removed rather than carried through. This matters because converted files get opened in browsers, and a converter that faithfully preserved a script would be a way of passing one along. Structural markup, links, images and tables all survive.`,
    });
  }
}

/** Limits and behaviours of the spreadsheet pipeline itself. */
function spreadsheetPipelineNotes(
  from: FormatSpec,
  to: FormatSpec,
  engine: string | null,
  notes: Note[],
) {
  const DATA = new Set(['csv', 'json', 'xlsx', 'xls', 'ods']);
  if (!DATA.has(from.id) || !DATA.has(to.id)) return;

  if (engine === 'spreadsheet') {
    notes.push({
      heading: 'Read directly, never opened',
      body: `No spreadsheet application is involved in this conversion. The file is parsed in our own process and the data is written straight out, which is both faster than launching an office suite and safer: macros in a workbook are never in a position to run, because nothing here is capable of running them. It also means the output is exactly the data, with none of an office suite's opinions about formatting applied on the way through.`,
    });
  }

  if (to.id === 'xlsx' || to.id === 'ods') {
    notes.push({
      heading: 'There is a ceiling on rows',
      body: `A spreadsheet is not a database: the format tops out at 1,048,576 rows and 16,384 columns, and a file approaching either becomes painful to open long before it reaches them. CSV and JSON have no such limit. If your data runs to millions of rows, converting it into a workbook is usually the wrong move — keep it as text and query it with something built for the volume.`,
    });
  }

  if (from.id === 'xlsx' || from.id === 'xls' || from.id === 'ods') {
    notes.push({
      heading: 'Formulas arrive as their results',
      body: `What is read is the value each cell had last time the workbook was calculated, not the formula that produced it. That is almost always what you want from an export. It does mean the output is a snapshot: nothing in it recalculates, and a workbook saved without being recalculated will export whatever stale values it was holding.`,
    });
  }

  if (from.id === 'json') {
    notes.push({
      heading: 'The top level has to be a list of records',
      body: `The converter expects an array of objects — the shape almost every API returns — and reads each object as a row. A single object, or a response with the real data nested under a wrapper key, does not describe a table on its own. If yours is wrapped, pull out the array before converting.`,
    });
  }
}

/** Word processor and presentation specifics beyond the LibreOffice caveat. */
function officeDetailNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  const WORDY = new Set(['docx', 'doc', 'odt', 'rtf']);

  if (WORDY.has(from.id) && to.id === 'pdf') {
    notes.push({
      heading: 'The text stays text',
      body: `This is not a picture of your document. The words remain selectable and searchable, links stay clickable, and the fonts are embedded so it renders identically on a machine that has never seen them. That is what separates a PDF made this way from one made by scanning a printout — and it is why this is the right way to send a document to someone who only needs to read it.`,
    });
  }

  if (WORDY.has(from.id) && to.id !== 'pdf' && OFFICE_SOURCES.has(from.id)) {
    notes.push({
      heading: 'Comments and tracked changes',
      body: `Editorial metadata is the first thing to go in a format conversion: comments, tracked changes and revision history rarely have an equivalent in ${T} and are generally dropped or flattened into the text. Treat the output as a clean copy of the current state of the document. If the review history matters, keep the ${F} alongside it.`,
    });
  }

  if (SLIDE_SOURCES.has(from.id) && to.id !== 'pdf') {
    notes.push({
      heading: 'Speaker notes and embedded media',
      body: `Slides carry more than what is projected. Speaker notes usually survive into another presentation format and vanish into anything flatter. Embedded video and audio are the fragile part — they are stored by reference or in a suite-specific way, and are the most common thing to find missing after a conversion. Check any deck that relies on them before presenting from the result.`,
    });
  }
}

/**
 * Text and markup being promoted into a real document format.
 *
 * These routes run through LibreOffice like the office-to-office ones, but the
 * concerns are the opposite way round: nothing is being lost in translation,
 * something is being invented that the source never specified.
 */
function richDocumentNotes(
  from: FormatSpec,
  to: FormatSpec,
  engine: string | null,
  notes: Note[],
) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  const PLAIN = new Set(['txt', 'html', 'csv', 'md']);
  const RICH = new Set(['pdf', 'docx', 'odt', 'rtf', 'xlsx', 'ods']);
  if (!PLAIN.has(from.id) || !RICH.has(to.id)) return;

  if (from.id === 'html') {
    notes.push({
      heading: 'A page that reflows becomes one that does not',
      body: `HTML describes a document that adapts to whatever window it is opened in; ${T} describes fixed pages of a fixed width. The converter has to choose a page size and commit the layout to it, so anything that depended on the width of the viewport is resolved to a single answer. Styling is approximated as closely as the target allows, and scripts are not run — whatever a page would have generated after loading is simply not in the file.`,
    });
    notes.push({
      heading: 'Remote images are not downloaded',
      body: `Images referenced by URL rather than embedded in the file are not fetched during conversion. That is a deliberate boundary: a converter that loaded remote resources would be making requests on your behalf, from our servers, to addresses inside a file we did not write. Anything linked externally will be missing from the result.`,
    });
  }

  if (from.id === 'txt' && to.id !== 'pdf') {
    notes.push({
      heading: 'It becomes editable, not formatted',
      body: `The result is a genuine ${T} you can open and edit in a word processor — but a text file carries no formatting to bring with it, so what you get is your text in a default typeface with default margins. Headings, styles and structure are yours to add afterwards. Nothing in a ${F} tells the converter which line was meant to be a title.`,
    });
  }

  if (from.id === 'csv' && to.id === 'pdf') {
    notes.push({
      heading: 'A table has to fit the page',
      body: `A CSV has no width — a row is as long as it needs to be. A PDF page does not have that luxury, so a table with many columns either shrinks to fit or spills onto further pages. Wide data rarely reads well this way. If the output is meant for people rather than for filing, consider narrowing the columns you actually need before converting.`,
    });
  }

  if (engine === 'office') {
    notes.push({
      heading: 'Rendered by LibreOffice',
      body: `The conversion runs through headless LibreOffice — the same engine behind the desktop suite. Fonts are the thing to watch: the document is typeset with what the server has available, and a substituted typeface rarely occupies exactly the same width as the one it replaces, so line breaks can fall differently than they would on your machine.`,
    });
  }

  if (engine === 'document' && to.id === 'pdf') {
    notes.push({
      heading: 'Typeset directly, without an office suite',
      body: `This route does not start LibreOffice. The PDF is written directly: your text is set in Helvetica at a readable size on an A4 page, wrapped to the measure, and broken onto a new page whenever it runs past the bottom. That makes it quick and entirely predictable. What it does not do is interpret formatting — there is none in a ${F} to interpret.`,
    });
  }
}

/** Rendering PDF pages to pixels, and reconstructing a PDF as a document. */
function pdfSourceNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  const T = to.id.toUpperCase();
  if (from.id !== 'pdf') return;

  if (to.category === 'image') {
    notes.push({
      heading: 'Everything flattens into one layer',
      body: `A PDF page is a stack of things — text, vector drawings, embedded photographs, form fields, annotations — kept separate right up until it is displayed. Rendering to ${T} collapses all of it into a single grid of pixels, exactly as the page appears on screen. Nothing on the page can be selected, edited or pulled out afterwards, and a form field becomes a picture of a form field.`,
    });
  }

  if (to.id === 'docx') {
    notes.push({
      heading: 'Headings are inferred from size',
      body: `A PDF does not record that a line was a heading — it records that it was set in larger type. The converter measures the most common font size, takes that as body text, and promotes anything meaningfully larger into a real Word heading. It is a good heuristic and it is still a heuristic: a document with unusual typography will need its styles corrected afterwards.`,
    });
    notes.push({
      heading: 'Images, tables and columns do not come across',
      body: `What is reconstructed is the text and its paragraph structure. Embedded images are not carried into the document, tables arrive as their text rather than as tables, and multi-column layouts are flattened into a single flow. If the PDF is mostly prose, the result is genuinely useful; if it is a designed layout, expect to be rebuilding it.`,
    });
    notes.push({
      heading: 'A scanned PDF cannot be converted this way',
      body: `If the PDF came from a scanner, its pages are photographs of words and there is no text layer to read. Rather than hand you an empty document, the job stops and tells you why. Such a file needs text recognition run over it first — converting it to an image format here will not help either, since that produces pictures of the same pictures.`,
    });
  }
}

/** Exporting an animated GIF from video. */
function gifExportNotes(from: FormatSpec, to: FormatSpec, notes: Note[]) {
  if (to.id !== 'gif' || from.category !== 'video') return;

  notes.push({
    heading: 'Short, small and silent by default',
    body: `A GIF grows very quickly with length and frame size, so the defaults are deliberately conservative: 15 frames per second, 480 pixels tall, and the first 30 seconds of the clip. All three are adjustable, and the export is capped at a minute. The audio track is dropped — GIF has no way to carry sound at all, which is the usual reason people are surprised by the result.`,
  });

  notes.push({
    heading: 'A palette is built for your clip',
    body: `Rather than reduce every frame to a fixed set of colours, the encoder analyses your footage first, builds a 256-colour palette that suits it, and then applies that palette with dithering to soften the banding. It is the difference between a GIF that looks acceptable and one that looks like it came from 1998. It also means a clip with one dominant colour scheme converts far better than one that cuts between very different scenes.`,
  });
}

/** A source that was never compressed in the first place. */
function uncompressedSourceNotes(
  from: FormatSpec,
  to: FormatSpec,
  toProfile: FormatProfile,
  notes: Note[],
) {
  const T = to.id.toUpperCase();
  if (from.id !== 'bmp' || to.category !== 'image') return;
  if (toProfile.kind === 'uncompressed') return;

  notes.push({
    heading: 'Expect a dramatic drop in size',
    body: `A BMP stores every pixel literally, with no compression at all — which is why they are so large. ${T} compresses, so the same image commonly lands somewhere between a tenth and a half of the size it started at. Nothing about the picture changes to achieve that: the file was simply storing its pixels in the least efficient way available.`,
  });
}

/**
 * Compression trade-offs for the still formats.
 *
 * Audio and video state these in their own words inside `mediaNotes`, because
 * "barely visible" is the wrong thing to tell someone converting a WAV.
 */
function compressionNotes(
  from: FormatSpec,
  to: FormatSpec,
  fromProfile: FormatProfile,
  toProfile: FormatProfile,
  notes: Note[],
) {
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  const fk = fromProfile.kind;
  const tk = toProfile.kind;

  if (isLossy(fk) && isExact(tk)) {
    notes.push({
      heading: 'Quality cannot come back',
      body: `${F} already discarded detail permanently, and ${T} stores exactly what it is given. The result will be noticeably larger while looking identical to the ${F} you started from — lossless preserves, it does not restore. That is still the right move if you are about to edit, because further saves will not degrade it again.`,
    });
  }

  if (isExact(fk) && isLossy(tk)) {
    notes.push({
      heading: 'This step is irreversible',
      body: `${F} holds every detail; ${T} keeps an approximation. The file gets much smaller, and converting back later will not undo it. Keep the ${F} original if the file is a master you will work from again.`,
    });
  }

  if (isLossy(fk) && isLossy(tk)) {
    notes.push({
      heading: 'Re-encoding costs a little quality',
      body: `Both formats are lossy, so this decodes ${F} and compresses again as ${T}. That second pass loses a small amount on top of what was already gone. It is barely visible once, and it accumulates if a file is converted repeatedly — so convert from the original rather than from a previous conversion.`,
    });
  }

  if (isExact(fk) && isExact(tk)) {
    notes.push({
      heading: 'Nothing is lost in this step',
      body: `Both ${F} and ${T} store every pixel exactly, so this conversion changes the container rather than the content. What changes is file size and what will open it — convert freely, and as often as you like, without degrading anything.`,
    });
  }
}

/**
 * Everything true and specific about converting `from` into `to`.
 *
 * Returns an empty array rather than filler when nothing applies, and never
 * repeats a heading — several families can legitimately reach the same
 * conclusion about a pair, and the reader should be told once.
 */
export function conversionNotes(
  from: FormatSpec,
  to: FormatSpec,
  fromProfile: FormatProfile,
  toProfile: FormatProfile,
): Note[] {
  const notes: Note[] = [];
  // Several routes are declared by more than one block of the registry and the
  // first declaration wins, so which engine actually runs cannot be guessed
  // from the formats. XLSX to CSV is the case that matters: it reads as an
  // office conversion and is in fact handled in process by the spreadsheet
  // engine, which never starts LibreOffice at all.
  const engine = findRoute(from.id, to.id)?.engine ?? null;
  const isMedia =
    from.category === 'audio' ||
    from.category === 'video' ||
    to.category === 'audio' ||
    to.category === 'video';

  imageNotes(from, to, fromProfile, toProfile, notes);
  imagePipelineNotes(from, to, notes);
  imageToPdfNotes(from, to, notes);
  vectorRasterNotes(from, to, notes);
  uncompressedSourceNotes(from, to, toProfile, notes);
  gifExportNotes(from, to, notes);
  pdfSourceNotes(from, to, notes);
  richDocumentNotes(from, to, engine, notes);
  mediaNotes(from, to, fromProfile, toProfile, notes);
  officeNotes(from, to, engine, notes);
  officeDetailNotes(from, to, notes);
  dataNotes(from, to, notes);
  spreadsheetPipelineNotes(from, to, engine, notes);
  textPipelineNotes(from, to, notes);
  archiveNotes(from, to, notes);
  documentNotes(from, to, notes);
  if (!isMedia) compressionNotes(from, to, fromProfile, toProfile, notes);

  const seen = new Set<string>();
  return notes.filter((note) => {
    if (seen.has(note.heading)) return false;
    seen.add(note.heading);
    return true;
  });
}
