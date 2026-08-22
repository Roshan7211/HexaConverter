import type { Category } from '@/types';

/**
 * Explanatory content for the five category pages.
 *
 * These pages carry an advertising unit and, until this existed, about a
 * hundred words of their own: a headline, a blurb and a directory of links.
 * They also sit at the top of the sitemap and in the main navigation, so they
 * are among the first things a visitor or a reviewer sees.
 *
 * Everything here describes what our own pipeline genuinely does — which
 * encoder runs, what it defaults to, what it discards — rather than restating
 * what the formats are. That belongs on the format pages, and repeating it
 * here would make five more pages that say what 251 pages already say.
 */

export interface CategoryNote {
  heading: string;
  body: readonly string[];
}

export const CATEGORY_NOTES: Readonly<
  Record<Category, readonly CategoryNote[]>
> = {
  image: [
    {
      heading: 'What runs when you convert an image',
      body: [
        'Images are processed with libvips, the same engine behind most large-scale image pipelines. It works on a streaming basis rather than loading the whole picture into memory at once, which is why a 200-megapixel scan converts without difficulty.',
        'Each target format has its own tuned defaults. JPEG is written at quality 82 through mozjpeg and stored progressively, so it renders in passes over a slow connection. PNG is written at maximum compression with adaptive filtering and stays fully lossless. WebP uses quality 82 and picks colour subsampling per image; AVIF uses quality 60, which is a visually higher setting than the number suggests, because quality scales are not comparable between codecs.',
      ],
    },
    {
      heading: 'Metadata is removed unless you ask for it',
      body: [
        'A photograph from a phone carries EXIF metadata: the camera and lens, the exposure settings, the timestamp, and often the GPS coordinates of where it was taken. None of it is visible in the picture, and all of it travels with the file.',
        'Converted images are written without it. The orientation flag is read and applied to the pixels first, so a portrait photograph does not come out on its side once the tag recording that is gone. If you need the metadata kept — cataloguing photographic work, for instance — there is a setting for it, off by default because the safer behaviour should be the one you get without thinking about it.',
      ],
    },
    {
      heading: 'Transparency needs somewhere to go',
      body: [
        'The most common silent loss in image conversion is the alpha channel. JPEG has none at all, so anything transparent must become a solid colour — we composite onto white, and the background is configurable if white is wrong for your case.',
        'The damage is invisible on a white page and obvious the moment the image lands on a coloured one. If a logo or a cut-out needs its transparency, convert to PNG or WebP rather than JPEG, and check the result against a mid-grey background rather than a white one.',
      ],
    },
  ],

  document: [
    {
      heading: 'Three different engines, depending on what you are converting',
      body: [
        'Office documents — Word, LibreOffice and their relatives — run through headless LibreOffice, the same engine behind the desktop suite rather than a lookalike parser. It reads documents the way an office application does, which is why ordinary files come across faithfully.',
        'Spreadsheet and data conversions between CSV, JSON and workbooks are handled in our own process instead. No office suite is launched, which is faster and also safer: macros in a workbook are never in a position to run, because nothing in that path is capable of running them.',
        'PDF pages are rendered with Poppler where the host provides it and a JavaScript fallback where it does not, so the route works on every deployment rather than only the ones that can install system packages.',
      ],
    },
    {
      heading: 'Fonts are what move your layout',
      body: [
        'A document names the typefaces it wants rather than carrying them. When the converting machine does not have one, it substitutes another — and a substitute rarely occupies exactly the same width per character.',
        'Slightly wider characters mean fewer words per line, more lines, and content pushed down the page. That is why a converted PDF occasionally has one more page than the document did, with a single orphaned paragraph on it. Nothing has broken; the text has been set in a different typeface. Sticking to widely available fonts, or embedding them before converting, avoids it entirely.',
      ],
    },
    {
      heading: 'A scanned PDF has no text in it',
      body: [
        'Two PDFs can look identical and be completely different files. One created by exporting from a word processor stores characters and their positions. One created by a scanner stores an image of a page — the words are visible to you as shapes, but there are no characters in the file at all.',
        'That decides what is possible. Text extraction and PDF-to-Word need text to work from, so on a scanned document they stop and explain why rather than handing you an empty file. Rendering pages to images works on either kind, because it does not care whether the page was made of text.',
      ],
    },
  ],

  audio: [
    {
      heading: 'Every conversion is a real re-encode',
      body: [
        'Audio is transcoded with ffmpeg using the reference encoder for each format: LAME for MP3, libopus for Opus, libvorbis for OGG, and FLAC or 16-bit PCM for the lossless targets.',
        'Lossy targets default to 192 kbps, adjustable from 32 up to 512. That default sits just past the point where most listeners stop reliably hearing a difference on typical equipment. Lossless targets get no bitrate at all, because applying one to a lossless format would be a contradiction — the size follows the audio itself.',
      ],
    },
    {
      heading: 'Converting between lossy formats costs a little each time',
      body: [
        'A lossy codec works by discarding what you are least likely to notice. Converting from one lossy format to another decodes the first and compresses again, so a second pass of loss lands on top of what was already gone.',
        'Once is very hard to hear. It compounds, and a file converted repeatedly between formats is genuinely worse by the fourth generation. Convert from the best source you have rather than from a previous conversion, and going to a lossless format does not undo any of it — lossless preserves, it does not restore.',
      ],
    },
    {
      heading: 'Two things that surprise people',
      body: [
        'Opus does not accept 44.1 kHz, the sample rate every CD-derived file carries, so audio converted to Opus is resampled to 48 kHz. That is a requirement of the codec rather than a setting, and it is not audible — but it explains why the resulting file reports a different rate from the one it came from.',
        'Tag formats also differ between families. MP3 uses ID3, FLAC and OGG use Vorbis comments, and M4A uses MP4 atoms. Title, artist and album normally map across; unusual custom fields and occasionally embedded artwork have nowhere to go. Check the tags before deleting an original if your library depends on them.',
      ],
    },
  ],

  video: [
    {
      heading: 'The extension is the box, not the contents',
      body: [
        'MP4, MOV, MKV, AVI and WebM are containers. A container records how the streams inside a file are packed together and kept in sync; it does not describe how the video is compressed. What decides how a video looks, how large it is, and whether it plays at all is the codec stored inside.',
        'That is why two files both ending in `.mp4` can behave completely differently, and why the useful question when a video will not play is never about the extension. It is almost always the codec.',
      ],
    },
    {
      heading: 'What your converted file will actually contain',
      body: [
        'MP4, MOV and MKV are written with H.264 video and AAC audio — the combination with the broadest support of anything in current use. MP4 additionally gets its index moved to the front of the file so playback can begin before the download finishes.',
        'WebM is written with VP9 and Opus, both royalty-free, which is the reason the format exists. VP9 encodes considerably slower than H.264, so expect a longer wait for the same clip. AVI is written with MPEG-4 Part 2 and MP3, the codecs it was designed around — roughly a generation behind, which means an AVI is usually larger than an MP4 of the same clip at the same quality, not smaller.',
      ],
    },
    {
      heading: 'This is a re-encode, not a repackage',
      body: [
        'Some tools can lift a stream out of one container and drop it into another untouched when the codecs happen to line up. We do not. Every job here is decoded and encoded again, so a conversion takes time in proportion to the length of the file and costs a small amount of quality even where a repackage would have been possible.',
        'What you get in exchange is predictability. The output contains the codecs we chose rather than whatever the source happened to hold, so it plays where you expect it to — which is usually the whole reason for converting a video in the first place.',
      ],
    },
  ],

  archive: [
    {
      heading: 'The archive is rebuilt, not renamed',
      body: [
        'Converting between archive formats unpacks the source in full and writes its contents into a new archive. Nothing is passed through untouched, so the compression is performed again from scratch and the folder structure inside is preserved exactly.',
        'That means the resulting size depends on the compression level you choose rather than on how the original was made. It defaults to 6, the sensible middle ground for deflate. Raising it buys a few percent for a disproportionate amount of time; lowering it is worth doing for archives full of photographs, audio or video, where the contents are already compressed and there is nothing left to squeeze.',
      ],
    },
    {
      heading: 'Per-file and solid compression',
      body: [
        'ZIP compresses each file inside it separately, so a tool can jump straight to any single entry and decompress just that one. TAR.GZ concatenates everything into one stream and compresses the whole thing in a single pass, which lets it find patterns repeating across files — usually producing a noticeably smaller archive, at the cost of having to decompress everything before a given file to reach it.',
        'There is a second difference that matters for anything destined for a server: tar-based formats record Unix permissions and symbolic links, and ZIP has no dependable place to put them. The executable bit is the one that goes missing most often.',
      ],
    },
    {
      heading: 'What we read but cannot write',
      body: [
        'RAR, 7z and plain gzip are accepted as sources and repackaged into open formats. RAR compression is proprietary — readable freely, not writable by open tools, which is a licensing boundary rather than a technical one. Plain gzip compresses a single stream and has no concept of multiple files at all, which is why it is nearly always paired with tar.',
        'One safety note for archives from any source you do not control: an archive can be crafted to expand to an enormous size from a very small file. Uploads with an abnormal compression ratio are rejected rather than unpacked.',
      ],
    },
  ],
};
