import type { Guide } from '@/content/guides/types';

export const webpVsAvif: Guide = {
  slug: 'webp-vs-avif',
  title: 'WebP or AVIF: choosing a modern image format',
  metaTitle:
    'WebP vs AVIF in 2026 — file size, browser support and which to actually use',
  description:
    'Both beat JPEG comfortably. They differ in how much they beat it by, how long they take to produce, and what will refuse to open them.',
  published: '2026-08-22',
  topic: 'image',
  formats: ['webp', 'avif', 'jpg', 'png'],
  intro: [
    'JPEG is thirty-four years old and PNG is not far behind. Both are still excellent at their jobs, and both are comfortably beaten on file size by formats designed with several more decades of research behind them.',
    'The two realistic modern choices are WebP and AVIF. They are not really competitors at the same point on the curve — one is the safe upgrade and the other is the aggressive one — and the right answer depends more on what will open your files than on which compresses better.',
  ],
  sections: [
    {
      heading: 'What each one is',
      body: [
        'WebP came out of Google in 2010, built from the VP8 video codec, and was designed to replace both JPEG and PNG at once. It compresses either lossily or losslessly, supports transparency in **both** modes, and can animate. That combination is its real strength: one format covering photographs, graphics, transparency and short animations.',
        'AVIF is newer and derived from AV1, a much more modern video codec. It compresses harder than WebP at the same visual quality, handles wide colour gamut and high dynamic range, and also supports transparency and animation. It is the more capable format on nearly every technical axis.',
        'Both are lossy by default and lossless if you ask, which makes the old JPEG-or-PNG decision largely unnecessary — you no longer have to choose a format to get transparency.',
      ],
    },
    {
      heading: 'The size difference in practice',
      body: [
        'Rough figures, for a photograph at visually comparable quality. Treat them as orders of magnitude rather than precise ratios, because the actual numbers depend heavily on the image.',
      ],
      table: {
        columns: ['Format', 'Relative size', 'Notes'],
        rows: [
          ['JPEG', '100%', 'The baseline everything is measured against'],
          [
            'WebP',
            '65–75%',
            'A consistent, dependable improvement across most images',
          ],
          [
            'AVIF',
            '40–60%',
            'Larger gains, and the gap widens at lower quality settings',
          ],
        ],
      },
      callout: {
        title: 'Where AVIF pulls away',
        body: 'At aggressive compression. Push JPEG hard and it falls apart into visible blocks; AVIF degrades far more gracefully, going soft rather than blocky. For thumbnails and previews the difference is dramatic.',
      },
    },
    {
      heading: 'Support is the real deciding factor',
      body: [
        'Browser support for both is now essentially universal — every current browser handles WebP and AVIF. That is not where the problem is.',
        'The problem is everything that is not a browser. Desktop image editors, print workflows, older phones, corporate document systems, the software your client uses, the photo frame your relative owns. WebP has had fifteen years to work its way into these and is now widely, though not completely, supported. AVIF is younger and the gaps are correspondingly larger.',
        "So the practical rule is about destination rather than format quality. If the image is going onto a web page you control, either works and AVIF saves more. If you are handing the file to somebody else — a client, a printer, another company's system — the older, more boring format is very often the correct engineering choice.",
      ],
    },
    {
      heading: 'AVIF is slow to produce',
      body: [
        'AVIF encoding comes from a video codec, and video codecs are computationally expensive. Encoding an AVIF takes noticeably longer than encoding a JPEG, a PNG or a WebP — this is inherent to the format, not a limitation of any particular tool.',
        'For a handful of images it does not matter. For a batch of several hundred it very much does, and it is worth knowing before you start. Decoding, by contrast, is fast enough that viewers will not notice anything.',
        "Our defaults reflect the difference: [converting to WebP](/tools/jpg-to-webp) uses quality 82, and [converting to AVIF](/tools/jpg-to-avif) uses quality 60. Those numbers are not comparable with each other, which is worth stressing — 60 on AVIF's scale is a visually higher setting than the number suggests, and setting AVIF to 82 produces a much larger file than you probably intended.",
      ],
    },
    {
      heading: 'A quality number means nothing on its own',
      body: [
        "This is the single most common mistake when moving between formats. Quality settings are not a shared scale. They are each codec's own internal dial, and the same number means different things in different formats.",
        'JPEG at 82 and WebP at 82 land in broadly similar territory, which is why those two are often given the same default. AVIF at 82 is a substantially higher quality target than either — you would be spending a great deal of file size to preserve detail nobody can see.',
        'The useful habit is to judge by result rather than by number. Convert one representative image, look at it at the size it will actually be displayed, and adjust from there. A number that worked in one format is not evidence about another.',
      ],
    },
    {
      heading: 'What to actually do',
      body: [
        'For most people the answer is WebP. It is a real improvement over JPEG and PNG, it handles transparency and animation, it encodes quickly, and by now very little will refuse to open it. It is the upgrade with the fewest ways to go wrong.',
        'Choose AVIF when bandwidth genuinely matters and you control the destination — a high-traffic site, a mobile-first product, a large gallery of photographs. The extra saving is real and worth having at scale.',
        "Keep JPEG and PNG when you are handing a file to someone else's workflow, when a client or printer has specified them, or when the recipient is unknown. [Converting WebP back to PNG](/tools/webp-to-png) is straightforward when you need to hand over something conventional — remembering that a lossy WebP cannot become lossless again, only stored losslessly from here on.",
      ],
    },
  ],
  related: [
    'jpg-to-webp',
    'png-to-webp',
    'jpg-to-avif',
    'webp-to-png',
    'avif-to-jpg',
  ],
  faq: [
    {
      question: 'Is AVIF better than WebP?',
      answer:
        'Technically, yes — it produces smaller files at the same visual quality and handles wide colour and HDR. WebP is better supported outside browsers and much faster to encode, which often matters more in practice.',
    },
    {
      question: 'Why does my AVIF look worse at the same quality number?',
      answer:
        "Because quality scales are not comparable between codecs. Each is the codec's own internal dial. Judge the result by looking at it rather than by matching numbers between formats.",
    },
    {
      question: 'Should I convert my whole photo library to AVIF?',
      answer:
        'Probably not. Encoding is slow, and archives are exactly where broad compatibility matters most. AVIF is a delivery format for images you are serving, not an obvious choice for long-term storage.',
    },
    {
      question: 'Can I convert AVIF back to JPEG?',
      answer:
        'Yes, and it is a common need when something will not open an AVIF. Remember that both are lossy, so the round trip costs a little quality — convert from an original wherever you still have one.',
    },
  ],
};
