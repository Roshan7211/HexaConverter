import type { Guide } from '@/content/guides/types';

export const audioBitrateExplained: Guide = {
  slug: 'audio-bitrate-explained',
  title: 'What 192 kbps actually means, and when you need more',
  metaTitle:
    'Audio bitrate explained: 128, 192, 320 kbps and when the difference is audible',
  description:
    'Bitrate is the single dial that decides how big an audio file is and how good it sounds. Here is what the numbers mean, why they are not comparable between codecs, and where the real thresholds sit.',
  published: '2026-08-22',
  topic: 'audio',
  formats: ['mp3', 'aac', 'ogg', 'opus', 'm4a', 'wav', 'flac'],
  intro: [
    'Bitrate is how much data a codec is allowed to spend on each second of audio, measured in kilobits per second. At 192 kbps, one minute of audio takes about 1.4 MB. At 320 kbps it takes about 2.4 MB, and at 64 kbps about 480 KB.',
    'That much is arithmetic. The interesting question — how much you actually need — has a more useful answer than "more is better", because the relationship between bitrate and audible quality is steeply diminishing and different for every codec.',
  ],
  sections: [
    {
      heading: 'What the encoder does with the budget',
      body: [
        'A lossy audio codec works by deciding what you will not miss. It models human hearing: quiet sounds immediately after loud ones are masked and can be discarded, frequencies above the range most adults can hear can go, and stereo information that is nearly identical in both channels can be stored once instead of twice.',
        'The bitrate is the budget for what survives that process. A generous budget means the encoder throws away only the genuinely inaudible; a tight one forces it to start discarding things you might actually notice. The first casualties are usually cymbals and applause — dense, noisy, high-frequency sounds that need a lot of data to describe and turn watery when they do not get it.',
        'This is why the same bitrate sounds different on different material. A solo piano recording is easy to encode and sounds fine at rates where a busy orchestral track or a live crowd recording audibly falls apart.',
      ],
    },
    {
      heading: 'Where the thresholds actually sit',
      body: [
        'For MP3, the practical landmarks are well established after twenty-five years of people arguing about them.',
      ],
      table: {
        columns: ['Bitrate', 'How it sounds', 'Reasonable for'],
        rows: [
          [
            '64 kbps',
            'Obviously degraded; hollow, watery cymbals',
            'Speech only',
          ],
          [
            '128 kbps',
            'Acceptable, but artefacts audible on good headphones',
            'Podcasts, background listening',
          ],
          [
            '192 kbps',
            'Very hard to distinguish from the source for most listeners',
            'The sensible default for music',
          ],
          [
            '256 kbps',
            'Transparent for nearly everyone, on nearly everything',
            'Music you care about',
          ],
          [
            '320 kbps',
            'The MP3 maximum; audibly identical to 256 in nearly all tests',
            'Peace of mind, at 25% more size',
          ],
        ],
      },
      callout: {
        title: 'Why 192 is our default',
        body: 'It sits just past the point where most listeners stop reliably hearing a difference, on typical equipment, with typical music. Below it people start noticing; above it, most of the extra bytes buy reassurance rather than sound.',
      },
    },
    {
      heading: 'The numbers do not transfer between codecs',
      body: [
        "This is the part that trips people up. A codec's bitrate tells you how much data it gets, not how well it spends it — and the newer codecs spend it considerably better.",
        'Opus at 96 kbps is broadly comparable to MP3 at 128, and often better. AAC sits between the two, which is why streaming services and Apple standardised on it. Vorbis, which is what an OGG file contains, is modestly ahead of MP3 and behind Opus.',
        'So "convert my 320 kbps MP3 to a 320 kbps Opus" is not a meaningful upgrade — it is a large file in a format that did not need to be that large. If you are choosing Opus, choose a lower bitrate and take the space saving; that is the entire point of it.',
      ],
      list: [
        '**Opus** — the strongest of the common lossy codecs, especially below 128 kbps. What WebM audio uses.',
        '**AAC** — clearly better than MP3 at the same bitrate; near-universal support. What M4A holds.',
        '**Vorbis** — modestly better than MP3, largely superseded by Opus for new work. What OGG holds.',
        '**MP3** — the weakest of the four, and still the one that plays on absolutely everything.',
      ],
    },
    {
      heading: 'Re-encoding is where quality quietly goes',
      body: [
        'Every lossy encode discards detail. Doing it twice discards detail twice, and the second pass is working from an already-damaged signal — it cannot tell which parts were the original recording and which were artefacts of the first encode, so it spends part of its budget faithfully preserving damage.',
        'Once is usually inaudible. The compounding is what matters: a file converted MP3 to AAC to Opus to MP3 has been through four generations of loss, and by then it is genuinely worse in a way people notice.',
        'The rule that follows is simple. Always convert from the best source you have, not from a previous conversion. If you have the CD rip or the original WAV, go back to it rather than converting the MP3 you made from it three years ago.',
      ],
    },
    {
      heading: 'When lossless is the right answer',
      body: [
        'FLAC and WAV both preserve every sample exactly. There is no bitrate to choose because nothing is being decided — the size follows the audio itself. FLAC compresses to roughly half the size of the equivalent WAV without losing anything at all; WAV applies no compression and runs to about 10 MB per minute of stereo.',
        'Lossless is worth it in three situations, and is largely wasted otherwise. If you are archiving — keeping a master you may need to re-encode differently in ten years — lossless means those future conversions start from the original rather than from a copy. If you are editing, it means repeated saves cost nothing. And if you are feeding a system that will re-encode anyway, giving it lossless input avoids stacking one lossy generation on another.',
        'For listening, on the equipment most people own, the honest answer is that a 256 kbps AAC and a FLAC of the same recording are extremely difficult to tell apart. [Converting FLAC to MP3](/tools/flac-to-mp3) to fit more music on a phone is a perfectly reasonable trade, provided you keep the FLAC.',
      ],
    },
    {
      heading: 'What our converter does',
      body: [
        'Lossy targets default to 192 kbps, adjustable from 32 up to 512. Lossless targets — FLAC and WAV — get no bitrate at all, because applying one to a lossless format would be a contradiction.',
        'One codec has a constraint worth knowing about. Opus does not accept 44.1 kHz, the sample rate every CD-derived file carries, so [audio converted to Opus](/tools/mp3-to-opus) is resampled to 48 kHz. That is a property of the codec rather than a choice, and it is inaudible — but it explains why an Opus file reports a different sample rate from the MP3 it came from.',
        'There is also loudness normalisation available, which adjusts a track to the EBU R128 broadcast standard. It is useful when assembling audio from different sources that were mastered at wildly different levels, and best left off when converting a single album that was mastered as a whole.',
      ],
    },
  ],
  related: [
    'wav-to-mp3',
    'flac-to-mp3',
    'mp3-to-aac',
    'mp4-to-mp3',
    'mp3-to-opus',
  ],
  faq: [
    {
      question: 'Is 320 kbps noticeably better than 192 kbps?',
      answer:
        'For most listeners on most equipment, no. In controlled listening tests the difference above roughly 256 kbps is very difficult to identify reliably. The file is about 65% larger, which is a real cost for a benefit few people can detect.',
    },
    {
      question: 'Does converting a 128 kbps MP3 to 320 kbps improve it?',
      answer:
        'No. The detail was discarded when the 128 kbps file was made and is not in the file to recover. You get a larger file that sounds the same, or very slightly worse for having been re-encoded.',
    },
    {
      question: 'Which audio format should I use?',
      answer:
        'MP3 when it has to play on absolutely anything. AAC or M4A when you want better quality at the same size and modern support is fine. Opus when size matters most. FLAC when you are archiving or editing.',
    },
    {
      question: 'Why did my sample rate change when converting to Opus?',
      answer:
        'Opus does not support 44.1 kHz, so the audio is resampled to 48 kHz. This is a requirement of the codec rather than a setting, and the difference is not audible.',
    },
  ],
};
