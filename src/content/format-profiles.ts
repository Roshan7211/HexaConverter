/**
 * Editorial profile for each supported format.
 *
 * The conversion landing pages carry the site's search traffic, and there are
 * 214 of them built from one template. Measured before this file existed, two
 * different routes shared 94% of their vocabulary and ran to roughly 318 words
 * — the shape Google's scaled-content policy is written about, and the usual
 * reason a utility site is turned down for advertising as "low value content".
 *
 * The answer is not more words. It is *per-format facts*, written once here and
 * composed into each route alongside notes derived from what actually differs
 * between the two formats. A page about PNG to JPEG then says something true
 * and specific about PNG, about JPEG, and about what that particular
 * conversion costs you — which is the thing a visitor arrived wanting to know.
 *
 * Two rules for anything added here. Every claim must be checkable, and the
 * `limits` must be honest: a page that only lists strengths reads as marketing
 * and is worth nothing to the person deciding whether to convert.
 */

/** How the format stores its data. Drives the conversion notes. */
export type CompressionKind =
  | 'lossy'
  | 'lossless'
  | 'either'
  | 'uncompressed'
  | 'vector'
  | 'text'
  | 'container';

export interface FormatProfile {
  /** Plain answer to "what is this file?" */
  what: string;
  /** Why you would choose it. */
  strengths: readonly string[];
  /** What it costs you. Stated plainly. */
  limits: readonly string[];
  /** Comparison-table cells. */
  compression: string;
  transparency: string;
  animation: string;
  typicalUse: string;
  kind: CompressionKind;
}

export const FORMAT_PROFILES: Readonly<Record<string, FormatProfile>> = {
  // ---------------------------------------------------------------- images
  jpg: {
    what: 'The photographic standard since 1992. JPEG throws away detail your eye is least likely to miss, which is why a photograph saved as JPEG is a fraction of the size of the same image saved losslessly.',
    strengths: [
      'Opens everywhere — no format is more widely supported',
      'Very small files for photographs and other continuous-tone images',
      'A quality dial, so you choose the trade against file size',
    ],
    limits: [
      'Lossy: detail is discarded permanently, and re-saving repeatedly compounds it',
      'No transparency at all',
      'Sharp edges, flat colour and text pick up visible halos',
    ],
    compression: 'Lossy',
    transparency: 'No',
    animation: 'No',
    typicalUse: 'Photographs, camera output, web images',
    kind: 'lossy',
  },
  png: {
    what: 'A lossless image format built for graphics rather than photographs. Every pixel it stores comes back exactly as it went in, and it carries a full alpha channel for transparency.',
    strengths: [
      'Lossless — no generation loss no matter how often you re-save',
      'Full 8-bit alpha, so edges blend cleanly over any background',
      'Sharp on text, screenshots, logos and line art',
    ],
    limits: [
      'Much larger than JPEG for photographs',
      'No animation in the baseline format',
      'Large photographic PNGs are slow to transfer',
    ],
    compression: 'Lossless',
    transparency: 'Yes — 8-bit alpha',
    animation: 'No',
    typicalUse: 'Screenshots, logos, UI assets, anything with transparency',
    kind: 'lossless',
  },
  webp: {
    what: "Google's image format, designed to replace both JPEG and PNG. It can compress either way — lossy for photographs, lossless for graphics — and supports transparency and animation in both modes.",
    strengths: [
      'Typically 25–35% smaller than JPEG at comparable quality',
      'Transparency in lossy mode, which JPEG cannot do at all',
      'One format covers photographs, graphics and short animations',
    ],
    limits: [
      'Older software and some print workflows still will not open it',
      'Lossy WebP discards detail just as JPEG does',
      'Editing tools support it less consistently than PNG or JPEG',
    ],
    compression: 'Lossy or lossless',
    transparency: 'Yes',
    animation: 'Yes',
    typicalUse: 'Web images where size matters',
    kind: 'either',
  },
  avif: {
    what: 'A modern image format derived from the AV1 video codec. It compresses harder than JPEG or WebP at the same visual quality, and handles wide colour and high dynamic range.',
    strengths: [
      'The smallest files of any format here at a given quality',
      'Transparency, animation, wide colour gamut and HDR',
      'Holds up better than JPEG at very low bitrates',
    ],
    limits: [
      'Support is newest — older browsers and many desktop apps cannot open it',
      'Encoding is slow compared with JPEG',
      'Fine detail can smooth over at aggressive settings',
    ],
    compression: 'Lossy or lossless',
    transparency: 'Yes',
    animation: 'Yes',
    typicalUse: 'Modern web delivery, bandwidth-sensitive images',
    kind: 'either',
  },
  tiff: {
    what: 'A flexible container used wherever image fidelity matters more than file size — scanning, publishing and archives. A single TIFF can hold multiple pages.',
    strengths: [
      'Lossless storage suitable for archival masters',
      'Multi-page, which suits scanned documents',
      'Standard in print, publishing and document capture',
    ],
    limits: [
      'Very large files',
      'Poor support in browsers — effectively unusable on the web',
      'So flexible that not every reader supports every variant',
    ],
    compression: 'Lossless (usually)',
    transparency: 'Yes',
    animation: 'No — but multi-page',
    typicalUse: 'Scanning, print production, archival masters',
    kind: 'lossless',
  },
  gif: {
    what: 'A 1987 format that survives for one reason: it animates, and it plays everywhere without a video player. Its palette is capped at 256 colours per frame.',
    strengths: [
      'Animation that works in any browser and any chat app',
      'Lossless within its 256-colour palette',
      'Universally supported after nearly four decades',
    ],
    limits: [
      '256 colours means visible banding on photographs',
      'Transparency is on-or-off per pixel, so edges look jagged',
      'Far larger than a real video file for the same clip',
    ],
    compression: 'Lossless, 256-colour palette',
    transparency: 'Yes — 1-bit, no partial',
    animation: 'Yes',
    typicalUse: 'Short loops, reaction clips, simple animations',
    kind: 'lossless',
  },
  svg: {
    what: 'Not pixels at all — an XML text file describing shapes, paths and text. A renderer draws it fresh at whatever size is asked for, so it is sharp at every scale.',
    strengths: [
      'Resolution independent — identical on a watch and a billboard',
      'Tiny for logos, icons and diagrams',
      'Editable as text, and styleable with CSS',
    ],
    limits: [
      'Cannot represent a photograph in any useful way',
      'Complex artwork can render slowly',
      'Converting a photo *to* SVG does not vectorise it',
    ],
    compression: 'Vector — text, not pixels',
    transparency: 'Yes',
    animation: 'Yes — via CSS or SMIL',
    typicalUse: 'Logos, icons, diagrams, illustrations',
    kind: 'vector',
  },
  bmp: {
    what: "Microsoft's plain bitmap. It generally stores pixels with no compression at all, which makes it simple to read and very large on disk.",
    strengths: [
      'Dead simple — every pixel stored literally',
      'No compression artefacts of any kind',
      'Reliably readable by old Windows software',
    ],
    limits: [
      'Enormous files, often ten times a PNG of the same image',
      'Effectively unusable on the web',
      'Transparency support is inconsistent between readers',
    ],
    compression: 'Uncompressed',
    transparency: 'Limited — 32-bit variants only',
    animation: 'No',
    typicalUse: 'Legacy Windows software, intermediate working files',
    kind: 'uncompressed',
  },
  heic: {
    what: "Apple's default photo format since iOS 11, storing HEVC-compressed images in a HEIF container. It is roughly half the size of an equivalent JPEG.",
    strengths: [
      'About half the size of JPEG at similar quality',
      'Keeps transparency, depth maps and image sequences',
      '10-bit colour, so smoother gradients than JPEG',
    ],
    limits: [
      'Poor support outside Apple platforms — this is the usual reason to convert',
      'Patent-encumbered, which is why support is uneven',
      'Lossy, so quality does not come back',
    ],
    compression: 'Lossy (HEVC)',
    transparency: 'Yes',
    animation: 'Yes — Live Photos and bursts',
    typicalUse: 'iPhone and iPad camera output',
    kind: 'lossy',
  },

  // ------------------------------------------------------------- documents
  pdf: {
    what: 'A fixed-layout page format. A PDF describes exactly where every glyph and line sits, so it looks identical everywhere — which is precisely what makes it awkward to edit.',
    strengths: [
      'Identical layout on every device, screen and printer',
      'Embeds its own fonts, so nothing reflows or substitutes',
      'The accepted format for contracts, invoices and forms',
    ],
    limits: [
      'Not built for editing — text is positioned, not flowing',
      'A scanned PDF is just images until text recognition is run',
      'Reflows badly on small screens',
    ],
    compression: 'Mixed — per object',
    transparency: 'Yes',
    animation: 'No',
    typicalUse: 'Contracts, invoices, forms, anything printed',
    kind: 'container',
  },
  docx: {
    what: "Word's modern format: a ZIP archive of XML parts describing text, styles and layout. It has been the default since Office 2007.",
    strengths: [
      'Built for editing — text flows and restyles freely',
      'Tracked changes, comments and styles',
      'Opens in Word, Google Docs, LibreOffice and Pages',
    ],
    limits: [
      'Layout shifts between applications and font sets',
      'Not a reliable final-delivery format — use PDF for that',
      'Complex documents can lose fidelity between editors',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Documents still being written or reviewed',
    kind: 'container',
  },
  doc: {
    what: "Word's pre-2007 binary format. Still common in long-lived archives, and still readable, but superseded by DOCX for nearly twenty years.",
    strengths: [
      'Readable by very old Office installations',
      'Common throughout older document archives',
    ],
    limits: [
      'Opaque binary format with a difficult history',
      'Larger than the equivalent DOCX',
      'Newer features simply do not exist in it',
    ],
    compression: 'Binary, uncompressed',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Legacy archives and older Office files',
    kind: 'container',
  },
  odt: {
    what: 'The OpenDocument text format — an ISO-standardised, vendor-neutral alternative to DOCX, and the native format of LibreOffice.',
    strengths: [
      'An open standard, not tied to one vendor',
      'Native to LibreOffice and OpenOffice',
      'Preferred or mandated by many public bodies',
    ],
    limits: [
      'Word opens it but does not always round-trip it cleanly',
      'Less common in commercial workflows',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'LibreOffice documents, public-sector exchange',
    kind: 'container',
  },
  rtf: {
    what: 'Rich Text Format: formatted text stored as readable plain text markup. A lowest common denominator that almost every word processor understands.',
    strengths: [
      'Opens in essentially any word processor, on any platform',
      'Keeps basic formatting where plain text cannot',
      'Human-readable if you open it in an editor',
    ],
    limits: [
      'Much larger than DOCX for the same content',
      'No modern layout features',
      'Images balloon the file size',
    ],
    compression: 'Plain text markup',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Exchange between unlike word processors',
    kind: 'text',
  },
  txt: {
    what: 'Just characters. No fonts, no sizes, no layout — which is exactly why it will still open, unchanged, in fifty years.',
    strengths: [
      'Universally readable, now and indefinitely',
      'Tiny, and works with every text tool ever written',
      'Nothing hidden — what you see is the whole file',
    ],
    limits: [
      'No formatting, images or structure whatsoever',
      'Character encoding must be right or accents break',
      'Line endings differ between Windows and everything else',
    ],
    compression: 'None',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Notes, logs, source data, long-term archives',
    kind: 'text',
  },
  md: {
    what: 'Plain text with a light, readable convention for headings, links and emphasis. It stays legible as text while converting cleanly to formatted output.',
    strengths: [
      'Readable as-is, with or without a renderer',
      'Diffs and version-controls well',
      'Converts cleanly to HTML, PDF and word processor formats',
    ],
    limits: [
      'No fine layout control',
      'Several competing dialects for tables and footnotes',
      'Complex documents outgrow it',
    ],
    compression: 'None — plain text',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Documentation, notes, README files',
    kind: 'text',
  },
  html: {
    what: 'The markup language of the web: text wrapped in tags that describe structure, which a browser then renders.',
    strengths: [
      'Opens in any browser on any device',
      'Structural and accessible when written properly',
      'Styleable, linkable and searchable',
    ],
    limits: [
      'Appearance depends on the renderer and its stylesheet',
      'Images and styles usually live outside the file',
      'No fixed pagination — awkward to print predictably',
    ],
    compression: 'Plain text markup',
    transparency: 'n/a',
    animation: 'Yes — via CSS',
    typicalUse: 'Web pages, email templates, exported reports',
    kind: 'text',
  },
  xlsx: {
    what: "Excel's modern workbook format — zipped XML holding sheets, formulas, formatting and charts.",
    strengths: [
      'Keeps live formulas, not just their results',
      'Multiple sheets, charts and conditional formatting',
      'The default in nearly every business',
    ],
    limits: [
      'Formula compatibility varies between spreadsheet applications',
      'Heavier than CSV for plain tabular data',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Spreadsheets, financial models, reports',
    kind: 'container',
  },
  xls: {
    what: "Excel's pre-2007 binary workbook. Capped at 65,536 rows, which is the limit people usually hit before deciding to convert.",
    strengths: [
      'Opens in very old versions of Excel',
      'Still emitted by some legacy systems',
    ],
    limits: [
      'Hard limit of 65,536 rows and 256 columns',
      'Binary and proprietary',
      'Superseded for nearly twenty years',
    ],
    compression: 'Binary',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Legacy spreadsheets and older exports',
    kind: 'container',
  },
  ods: {
    what: 'The OpenDocument spreadsheet — the open-standard counterpart to XLSX, and the native format of LibreOffice Calc.',
    strengths: [
      'Open standard with no vendor lock-in',
      'Formulas, multiple sheets and charts',
    ],
    limits: [
      'Excel round-trips it imperfectly, especially complex formulas',
      'Less common commercially',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'LibreOffice Calc, open-standard exchange',
    kind: 'container',
  },
  csv: {
    what: 'Rows of plain text with values separated by commas. No formatting, no formulas, no sheets — just the data, which is what makes it universal.',
    strengths: [
      'Readable by every spreadsheet, database and programming language',
      'Tiny, and trivial to generate or parse',
      'Nothing hidden — the file is exactly what it appears to be',
    ],
    limits: [
      'One table only: no sheets, formulas, colours or charts',
      'No standard for encoding, so accents and symbols often corrupt',
      'Commas and line breaks inside values need careful quoting',
    ],
    compression: 'None — plain text',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'Data exchange, imports and exports, reporting',
    kind: 'text',
  },
  json: {
    what: 'A structured text format for nested data. Unlike CSV it represents hierarchy, which is why nearly every web API speaks it.',
    strengths: [
      'Represents nesting and lists, not just flat rows',
      'Parsed natively by essentially every language',
      'Readable, and precise about types',
    ],
    limits: [
      'More verbose than CSV for plain tables',
      'Awkward to read in a spreadsheet without flattening',
      'No comments, and no native date type',
    ],
    compression: 'None — plain text',
    transparency: 'n/a',
    animation: 'No',
    typicalUse: 'APIs, configuration, structured exports',
    kind: 'text',
  },
  pptx: {
    what: "PowerPoint's modern format — zipped XML holding slides, layouts, media and transitions.",
    strengths: [
      'Fully editable slides, layouts and speaker notes',
      'Carries embedded media and transitions',
      'The default for presentations nearly everywhere',
    ],
    limits: [
      'Fonts and layout shift on machines without the same typefaces',
      'Large once video and images are embedded',
      'Animations rarely survive conversion to anything else',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'Yes — slide transitions',
    typicalUse: 'Presentations still being edited',
    kind: 'container',
  },
  ppt: {
    what: "PowerPoint's pre-2007 binary format, still found in older archives and superseded by PPTX.",
    strengths: [
      'Opens in very old versions of PowerPoint',
      'Common in long-lived presentation archives',
    ],
    limits: [
      'Binary and proprietary',
      'Larger than the equivalent PPTX',
      'Missing every feature added since 2007',
    ],
    compression: 'Binary',
    transparency: 'n/a',
    animation: 'Yes — slide transitions',
    typicalUse: 'Legacy presentations',
    kind: 'container',
  },
  odp: {
    what: 'The OpenDocument presentation format, native to LibreOffice Impress and standardised rather than vendor-owned.',
    strengths: ['Open standard, no lock-in', 'Native to LibreOffice Impress'],
    limits: [
      'PowerPoint round-trips it imperfectly',
      'Animations and transitions translate poorly',
    ],
    compression: 'Zipped XML',
    transparency: 'n/a',
    animation: 'Yes — slide transitions',
    typicalUse: 'LibreOffice Impress presentations',
    kind: 'container',
  },

  // ----------------------------------------------------------------- audio
  mp3: {
    what: 'The format that made digital music portable. Lossy, thirty years old, and still the safest choice when you have no idea what will play the file.',
    strengths: [
      'Plays on essentially every device ever made',
      'Small files at listenable quality',
      'Patents long expired, so support is everywhere',
    ],
    limits: [
      'Lossy — detail is gone permanently',
      'Beaten by AAC and Opus at the same bitrate',
      'No transparency about what was discarded',
    ],
    compression: 'Lossy',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Music, podcasts, anything that must simply play',
    kind: 'lossy',
  },
  wav: {
    what: 'Raw uncompressed audio samples in a thin container. Exactly what came off the recorder, at roughly 10 MB per minute of stereo CD-quality sound.',
    strengths: [
      'Bit-for-bit perfect — nothing is discarded',
      'No decoding overhead, so editors handle it fastest',
      'The standard working format for recording and editing',
    ],
    limits: [
      'Very large — around 10 MB per minute',
      'No built-in tags for artist or album',
      'Impractical for distribution or streaming',
    ],
    compression: 'Uncompressed PCM',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Recording, editing, mastering',
    kind: 'uncompressed',
  },
  flac: {
    what: 'Lossless compression for audio. Roughly half the size of WAV, and it decodes back to the original samples exactly — nothing is approximated.',
    strengths: [
      'Perfect reconstruction — identical to the source',
      'Around 50–60% of the size of WAV',
      'Full tagging, and an open royalty-free format',
    ],
    limits: [
      'Still far larger than MP3 or AAC',
      'Not supported by every portable player or car stereo',
    ],
    compression: 'Lossless',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Archiving, high-fidelity libraries',
    kind: 'lossless',
  },
  ogg: {
    what: 'An open container, normally holding Vorbis audio. Created specifically to avoid the patent licensing that surrounded MP3.',
    strengths: [
      'Open and royalty-free',
      'Better quality than MP3 at the same bitrate',
      'Standard in games and open-source software',
    ],
    limits: [
      'Lossy',
      'Patchy support on consumer hardware',
      'Largely superseded by Opus for new work',
    ],
    compression: 'Lossy (Vorbis)',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Games, open-source projects, streaming',
    kind: 'lossy',
  },
  opus: {
    what: 'The current state of the art in lossy audio, standardised by the IETF. It outperforms MP3 and AAC across the range and is dramatically better at low bitrates.',
    strengths: [
      'Best quality per byte of any format here',
      'Excellent for speech as well as music',
      'Open, royalty-free, and low latency',
    ],
    limits: [
      'Lossy',
      'Older devices and some players will not open it',
      'Less familiar, so people distrust the file extension',
    ],
    compression: 'Lossy',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Voice, streaming, bandwidth-limited audio',
    kind: 'lossy',
  },
  aac: {
    what: "MP3's designated successor, and the default in the Apple ecosystem and most streaming services. Better sound than MP3 at the same bitrate.",
    strengths: [
      'Noticeably better than MP3 at equal bitrates',
      'The default across Apple devices and most streaming',
      'Handles multichannel audio properly',
    ],
    limits: ['Lossy', 'Patent licensing is more involved than Opus or Vorbis'],
    compression: 'Lossy',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Streaming, Apple devices, video soundtracks',
    kind: 'lossy',
  },
  m4a: {
    what: 'An MPEG-4 container holding audio only — usually AAC, sometimes lossless ALAC. The extension tells you the wrapper, not the contents.',
    strengths: [
      'Rich tagging, including chapters and artwork',
      'Holds either lossy AAC or lossless ALAC',
      'The standard for iTunes and Apple Music files',
    ],
    limits: [
      'The extension alone does not tell you the quality inside',
      'Support outside Apple platforms is inconsistent',
    ],
    compression: 'Container — usually lossy AAC',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Apple audio, audiobooks, podcasts',
    kind: 'container',
  },

  // ----------------------------------------------------------------- video
  mp4: {
    what: 'The universal video container, normally holding H.264 video and AAC audio. If a device plays video at all, it plays MP4.',
    strengths: [
      'Plays on effectively every device, browser and editor',
      'Excellent compression at high quality',
      'Streams well, and seeks quickly',
    ],
    limits: [
      'H.264 carries patent licensing obligations',
      'Lossy — quality drops each time it is re-encoded',
      'Less flexible than MKV for subtitles and multiple tracks',
    ],
    compression: 'Lossy (usually H.264)',
    transparency: 'No',
    animation: 'n/a',
    typicalUse: 'Everything — the safe default for video',
    kind: 'container',
  },
  webm: {
    what: 'An open container built for the web, holding VP8, VP9 or AV1 video with Vorbis or Opus audio. Royalty-free by design.',
    strengths: [
      'Open and royalty-free',
      'Smaller than H.264 MP4 at similar quality',
      'Supports transparency, which MP4 does not',
    ],
    limits: [
      'Weaker support in desktop editors and older devices',
      'Slower to encode than H.264',
      'Not the safe choice for sending a file to someone',
    ],
    compression: 'Lossy (VP9 or AV1)',
    transparency: 'Yes — with VP9 or AV1',
    animation: 'n/a',
    typicalUse: 'Web video, background loops with transparency',
    kind: 'container',
  },
  mkv: {
    what: 'Matroska: an open container that will hold almost any combination of video, audio, subtitle and chapter tracks in one file.',
    strengths: [
      'Unlimited tracks — multiple languages, subtitles, chapters',
      'Codec-agnostic, so it holds nearly anything',
      'Open, well documented, and resilient to damage',
    ],
    limits: [
      'Browsers will not play it natively',
      'Many TVs and phones refuse it — the usual reason to convert',
      'Being a container, contents vary wildly file to file',
    ],
    compression: 'Container — any codec',
    transparency: 'Depends on codec',
    animation: 'n/a',
    typicalUse: 'Archival video, multi-language releases',
    kind: 'container',
  },
  mov: {
    what: "Apple's QuickTime container. Technically close to MP4 — the two share ancestry — but tuned for editing and Apple's tools.",
    strengths: [
      'The native output of Apple cameras and Final Cut',
      'Handles high-quality intermediate codecs like ProRes',
      'Supports transparency with the right codec',
    ],
    limits: [
      'Larger than MP4, especially with editing codecs',
      'Inconsistent support outside Apple platforms',
      'ProRes files are enormous',
    ],
    compression: 'Container — often H.264 or ProRes',
    transparency: 'Yes — with ProRes 4444',
    animation: 'n/a',
    typicalUse: 'Apple cameras, video editing',
    kind: 'container',
  },
  avi: {
    what: 'A Microsoft container from 1992. Still readable everywhere, but it predates modern streaming, subtitles and variable bitrate audio.',
    strengths: [
      'Opens in very old software',
      'Simple, well-understood structure',
    ],
    limits: [
      'Much larger than MP4 for the same quality',
      'No native subtitle support',
      'Poor handling of variable bitrate audio and modern codecs',
    ],
    compression: 'Container — usually older codecs',
    transparency: 'No',
    animation: 'n/a',
    typicalUse: 'Legacy video files',
    kind: 'container',
  },

  // --------------------------------------------------------------- archives
  zip: {
    what: 'The archive format every operating system opens without extra software. Each file inside is compressed separately, so any one of them can be read without unpacking the rest.',
    strengths: [
      'Built into Windows, macOS and Linux — nothing to install',
      'Random access: extract one file without expanding everything',
      'Supports password protection',
    ],
    limits: [
      'Compresses less than 7z or tar.gz',
      'Per-file compression misses redundancy between files',
      'Its legacy encryption is weak — only AES is worth using',
    ],
    compression: 'Per-file (Deflate)',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Sending several files as one, universal exchange',
    kind: 'container',
  },
  tar: {
    what: 'Not a compressor at all — a way of concatenating many files into one while preserving Unix permissions, ownership and symbolic links. Compression is applied afterwards, if at all.',
    strengths: [
      'Preserves Unix permissions, ownership and links exactly',
      'The standard for backups and software distribution',
      'Streams, so it works down a pipe',
    ],
    limits: [
      'No compression by itself — a tar is as big as its contents',
      'No random access without reading through the file',
      'Awkward on Windows without extra software',
    ],
    compression: 'None — container only',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Unix backups, software packaging',
    kind: 'container',
  },
  tgz: {
    what: 'A tar archive passed through gzip. The tar preserves the file tree and its permissions; gzip compresses the whole stream in one pass.',
    strengths: [
      'Compresses better than ZIP by finding redundancy across files',
      'Keeps Unix permissions and links',
      'The default for source code releases',
    ],
    limits: [
      'No random access — one file means decompressing everything before it',
      'Needs extra software on Windows',
    ],
    compression: 'Solid stream (gzip)',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Source releases, Unix backups',
    kind: 'container',
  },
  '7z': {
    what: 'The high-compression archive format, using LZMA. It routinely produces the smallest file of anything here, at the cost of time and memory.',
    strengths: [
      'The best compression ratios available here',
      'Strong AES-256 encryption',
      'Solid mode compresses similar files together very effectively',
    ],
    limits: [
      'Needs software installed on Windows and macOS',
      'Slow to compress, and memory-hungry',
      'Less universal than ZIP for sending to other people',
    ],
    compression: 'Solid (LZMA)',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Maximum compression, long-term storage',
    kind: 'container',
  },
  rar: {
    what: 'A proprietary archive format from WinRAR. Its compression is good and its recovery records are genuinely useful, but only its owner licenses the ability to create one.',
    strengths: [
      'Strong compression with optional recovery records',
      'Handles multi-volume splitting well',
      'Common in older download archives',
    ],
    limits: [
      'Proprietary — creating RAR files requires licensed software',
      'We can extract from RAR but cannot produce it',
      'Needs extra software on most systems',
    ],
    compression: 'Proprietary',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Opening archives someone else sent you',
    kind: 'container',
  },
  gz: {
    what: 'A single-stream compressor, not an archive. Gzip compresses one file; bundling many requires tar first, which is why tar.gz is so common.',
    strengths: [
      'Fast to compress and very fast to decompress',
      'Universal on Unix systems and across the web',
      'Streams cleanly through pipes',
    ],
    limits: [
      'One file only — it cannot hold a directory',
      'Compresses less than LZMA',
      'No integrity protection beyond a basic checksum',
    ],
    compression: 'Single stream (DEFLATE)',
    transparency: 'n/a',
    animation: 'n/a',
    typicalUse: 'Compressing one file, web transfer encoding',
    kind: 'container',
  },
};

/** Profile for a format id, or null when none is written yet. */
export function profileFor(id: string): FormatProfile | null {
  return FORMAT_PROFILES[id] ?? null;
}
