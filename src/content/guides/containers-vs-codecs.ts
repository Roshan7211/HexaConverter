import type { Guide } from '@/content/guides/types';

export const containersVsCodecs: Guide = {
  slug: 'mp4-mov-mkv-containers-vs-codecs',
  title: 'MP4, MOV and MKV are not really video formats',
  metaTitle:
    'Containers vs codecs: what MP4, MOV, MKV, AVI and WebM actually are',
  description:
    'The extension on a video file tells you far less about it than most people assume. Understanding the difference between a container and a codec explains almost every confusing thing about video conversion.',
  published: '2026-08-22',
  topic: 'video',
  formats: ['mp4', 'mov', 'mkv', 'avi', 'webm'],
  intro: [
    'Two files both called `.mp4` can have almost nothing in common. One might play on every device you own; the other might refuse to open on your phone, in your browser and in the editing software you just bought. Neither file is broken, and the extension is not lying to you — it is simply answering a different question from the one you thought you were asking.',
    'The reason is that MP4 is a container. So are MOV, MKV, AVI and WebM. A container does not describe how the video is compressed; it describes how the compressed pieces are packed together in a file. What actually determines whether your video plays, how it looks and how large it is, is the **codec** stored inside.',
  ],
  sections: [
    {
      heading: 'The box and the thing in the box',
      body: [
        'A video file has to hold several separate streams at once and keep them synchronised: the picture, one or more audio tracks, often subtitles, sometimes chapter marks and metadata. The container is the filing system that keeps all of that in order — it records what is inside, in what order, and which moment of audio belongs with which frame of video.',
        'The codec is the compression method applied to each stream individually. H.264, H.265, VP9 and AV1 are video codecs. AAC, MP3, Opus and Vorbis are audio codecs. The codec is where all the interesting decisions happen: how much detail is kept, how large the file ends up, how much processing power is needed to play it back.',
        'So "MP4" tells you how the file is organised. It does not tell you what is inside. An MP4 usually contains H.264 video and AAC audio, because that is the combination everything supports — but it is a convention, not a rule, and an MP4 containing H.265 will fail to play in places an H.264 one works perfectly.',
      ],
      callout: {
        title: 'The rule of thumb',
        body: 'When a video will not play, the container is almost never the problem. It is nearly always the codec inside it.',
      },
    },
    {
      heading: 'Which is why MOV and MP4 are near-twins',
      body: [
        "MOV is Apple's QuickTime format, and MP4's file structure was taken directly from it when the standard was written. They are close cousins rather than rivals: structurally similar, holding the same codecs, opened by the same players.",
        'That is why [converting MOV to MP4](/tools/mov-to-mp4) so often feels like it should be instant. In principle, when the video inside is already H.264, the streams could be lifted out of one box and dropped into the other without being touched — an operation usually called remuxing, which is fast and costs nothing in quality.',
        'We do not do that, and it is worth being straightforward about why. Remuxing only works when the codec inside happens to be one the destination accepts, and it hands you a file whose contents you did not choose — inheriting whatever the source contained, including codecs that will not play where you need them to. Every conversion here is decoded and re-encoded to a known combination instead. It takes longer and costs a small amount of quality; in exchange the output is predictable.',
      ],
    },
    {
      heading: 'What each container is actually for',
      body: [
        'The containers differ less in capability than in what they will accept and where they are supported. This is the practical summary.',
      ],
      table: {
        columns: ['Container', 'Accepts', 'Best for'],
        rows: [
          [
            'MP4',
            'A broad but defined set — H.264 and AAC are the safe pair',
            'Anything that has to play everywhere: phones, browsers, TVs, social platforms',
          ],
          [
            'MOV',
            'Effectively the same as MP4',
            'Apple editing workflows; Final Cut and older Apple tooling expect it',
          ],
          [
            'MKV',
            'Almost any codec that exists, plus multiple audio tracks, subtitles and chapters',
            'Archiving films and anything with several language tracks',
          ],
          [
            'WebM',
            'A deliberately short list: VP8, VP9 or AV1 with Vorbis or Opus',
            'The open web, where royalty-free codecs matter',
          ],
          [
            'AVI',
            'Old codecs; modern ones fit badly or not at all',
            'Legacy software and hardware that will read nothing else',
          ],
        ],
      },
    },
    {
      heading: 'WebM is the one with real restrictions',
      body: [
        'WebM is Matroska with the guest list shortened. It is the same underlying container design as MKV, restricted to a deliberately narrow set of codecs — VP8, VP9 or AV1 for video, Vorbis or Opus for audio — all of them royalty-free. That restriction is the entire point of the format: it exists so that browsers can support video without licensing obligations.',
        'The consequence is that H.264 cannot go in a WebM. Not "does not usually" — it is not permitted. So [converting anything to WebM](/tools/mp4-to-webm) always involves genuinely re-compressing the video into VP9, and VP9 encodes considerably slower than H.264. If a WebM conversion is taking noticeably longer than the same clip as MP4, that is why.',
        'There is a small compensation on the audio side. WebM audio is written as Opus, which is the strongest of the common lossy audio codecs at low bitrates. Opus does not accept 44.1 kHz — the rate every CD-derived file carries — so the audio is resampled to 48 kHz on the way through.',
      ],
    },
    {
      heading: 'AVI is where files get bigger, not smaller',
      body: [
        "AVI is built on RIFF, Microsoft's chunk format from 1992, and it predates essentially everything about modern video. It has no proper support for chapters, subtitles or modern metadata, and modern codecs fit into it awkwardly at best.",
        'When you [convert to AVI](/tools/mp4-to-avi) here, the video is written as MPEG-4 Part 2 and the audio as MP3 — the codecs AVI was designed around. Both are roughly a generation behind what an MP4 would give you, which produces a genuinely counter-intuitive result: **an AVI is usually larger than an MP4 of the same clip at the same visual quality**, not smaller.',
        'That makes AVI worth choosing in exactly one situation: something old needs to read the file and will not accept anything else. It is not a quality format, it is not a compact format, and it is not an archival format. If you have been converting to AVI out of habit, MP4 is better on every axis you are likely to care about.',
      ],
    },
    {
      heading: "MKV is the archivist's container",
      body: [
        'Matroska imposes no codec restrictions at all, and it has proper places to put the things other containers handle badly: several audio tracks, several subtitle tracks, chapter marks, attachments. That is why it is the format of choice for keeping a film with its original and dubbed audio, or with subtitles in six languages.',
        'Its weakness is support rather than capability. Browsers do not play MKV, and plenty of consumer devices will not either. It is a format for your own library rather than one to send to somebody. [Converting MKV to MP4](/tools/mkv-to-mp4) is the usual move when a file needs to leave the shelf — accepting that extra audio and subtitle tracks have nowhere to go in the result.',
      ],
    },
    {
      heading: 'What this means when a video will not play',
      body: [
        'The next time a file refuses to open, the useful diagnostic is not the extension. Ask what codec is inside it. A `.mp4` that will not play on an older device is very likely H.265 rather than H.264. A `.mkv` that plays on your computer and not on your TV is likely using a codec the TV has never heard of.',
        'The fix in both cases is the same, and it is why re-encoding rather than remuxing is the more useful default: convert it to MP4 and you get H.264 video with AAC audio, the combination with the broadest support of anything in current use. It is not the most efficient pairing available any more, but it is the one that plays.',
      ],
    },
  ],
  related: [
    'mov-to-mp4',
    'mkv-to-mp4',
    'webm-to-mp4',
    'avi-to-mp4',
    'mp4-to-webm',
  ],
  faq: [
    {
      question: 'Is MP4 better quality than MOV?',
      answer:
        'Neither container has a quality of its own. Quality is decided by the codec inside and the settings it was encoded with. A MOV and an MP4 holding the same H.264 stream are visually identical files in differently shaped boxes.',
    },
    {
      question: 'Why does converting to WebM take so much longer?',
      answer:
        'WebM only accepts VP8, VP9 or AV1, so the video genuinely has to be re-compressed rather than repackaged, and VP9 encoding is considerably slower than H.264. The wait is the encoder working, not the upload.',
    },
    {
      question: 'Why is my AVI bigger than the MP4 it came from?',
      answer:
        'Because AVI is written with MPEG-4 Part 2 rather than H.264. That codec is about a generation behind, so it needs more data to reach the same visual quality. AVI is a compatibility format, not an efficient one.',
    },
    {
      question: 'Which video format should I use?',
      answer:
        'MP4 unless you have a specific reason not to. It plays on more things than anything else. Choose MKV to archive something with multiple audio or subtitle tracks, WebM when you specifically want royalty-free codecs for the web, and AVI only when something old demands it.',
    },
  ],
};
