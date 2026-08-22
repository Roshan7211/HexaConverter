import type { Guide } from '@/content/guides/types';

export const imageTransparency: Guide = {
  slug: 'image-transparency-and-what-breaks-it',
  title: 'Where your transparent background went',
  metaTitle:
    'Image transparency explained: alpha channels, white boxes and jagged edges',
  description:
    'Transparency is the property most often lost silently in a conversion — the file looks perfect until it lands on a coloured background and grows a white rectangle.',
  published: '2026-08-22',
  topic: 'image',
  formats: ['png', 'jpg', 'webp', 'gif', 'svg', 'avif', 'bmp'],
  intro: [
    'You export a logo, check it, and it looks right. You place it on a coloured page and it arrives inside a white box. Nothing is broken and nobody made a mistake — the transparency was discarded during a conversion, and on the white background you were checking against, discarded transparency and real transparency look identical.',
    'This is the most quietly destructive thing a format conversion does, precisely because the damage is invisible until the moment it matters.',
  ],
  sections: [
    {
      heading: 'What an alpha channel actually is',
      body: [
        'A normal image stores three numbers per pixel: how much red, green and blue. An image with transparency stores a fourth, called alpha, describing how opaque that pixel is — 0 for completely invisible, 255 for completely solid, and everything in between for partly see-through.',
        'That in-between range is what makes transparency look good rather than merely work. The edge of a circular logo is not a hard boundary between "logo" and "nothing"; it is a band of pixels at 90%, 70%, 40% opacity, blending the shape smoothly into whatever sits behind it. Without those intermediate values you get a staircase of hard pixels, which is why some transparent images look crisp and others look like they were cut out with scissors.',
      ],
    },
    {
      heading: 'Which formats can hold it',
      body: [
        'Support falls into three groups, and the middle one causes most of the trouble.',
      ],
      table: {
        columns: ['Format', 'Transparency', 'Consequence'],
        rows: [
          [
            'PNG',
            'Full 8-bit alpha',
            'The dependable choice; smooth edges over any background',
          ],
          [
            'WebP',
            'Full alpha, in lossy and lossless modes',
            'Transparency without PNG file sizes',
          ],
          ['AVIF', 'Full alpha', 'The same, compressed harder'],
          [
            'SVG',
            'Inherent — it draws shapes, not rectangles',
            'Nothing to lose; ideal for logos',
          ],
          [
            'GIF',
            'One bit only — on or off',
            'Hard, jagged edges with no blending',
          ],
          [
            'JPEG',
            'None whatsoever',
            'Transparency becomes a solid colour, always',
          ],
          [
            'BMP',
            'Inconsistent between readers',
            'Unreliable in practice; treat as none',
          ],
        ],
      },
    },
    {
      heading: 'What happens when it has nowhere to go',
      body: [
        'When you [convert a PNG to JPEG](/tools/png-to-jpg), the alpha channel has no destination. Something has to be decided for every transparent pixel, because JPEG requires an actual colour there — there is no way to write "nothing" into a JPEG.',
        'The convention, and what we do, is to composite onto white. Transparent areas become white; partly transparent areas become the appropriate blend of their colour and white. On a white page this is invisible, which is exactly why the problem so often escapes review and surfaces later.',
        'The background colour is configurable if white is wrong for your case. If you know the logo is going onto a specific colour, compositing onto that colour instead produces a result that looks correct in place — though it is then tied to that background, which is a fragile arrangement compared with keeping the alpha.',
      ],
      callout: {
        title: 'How to catch it every time',
        body: 'Check the converted file against a mid-grey or strongly coloured background, never white. Discarded transparency is invisible on white and obvious on anything else.',
      },
    },
    {
      heading: 'GIF transparency is not the same thing',
      body: [
        'GIF technically supports transparency, which leads people to believe it is a safe destination. Its transparency is a single bit per pixel: each pixel is either fully visible or fully invisible, with nothing in between.',
        'So the smooth 40%-opacity band around a curved edge cannot be represented. Each of those pixels has to be rounded to either fully on or fully off, producing the hard, stepped edges characteristic of GIF logos. Worse, if the image was anti-aliased against a white background before conversion, the semi-transparent pixels become opaque light-grey ones — leaving a pale fringe around your shape that is visible on any dark background.',
        'If a logo has curves or soft edges and needs to sit on an unknown background, GIF is not an adequate destination. PNG or WebP is.',
      ],
    },
    {
      heading: 'Vectors sidestep the problem entirely',
      body: [
        'An SVG is not a rectangle of pixels at all. It is a description of shapes, and there is no concept of a background — the areas where no shape is drawn are simply areas where nothing is drawn. Transparency is not a feature bolted onto SVG; it is what happens by default.',
        'That, plus resolution independence, is why logos and icons should live as SVG wherever possible. It stays sharp at any size and has no background to accidentally lose.',
        '[Rasterising an SVG](/tools/svg-to-png) preserves the transparency provided the destination supports it — PNG does, JPEG does not, and the same white box appears if you choose the latter. Note that something must decide the pixel dimensions at that point: an SVG has no intrinsic size, so we use the size declared in the file and fall back to 1024 pixels wide when it declares none.',
      ],
    },
    {
      heading: 'Choosing a destination',
      body: [
        'If the image needs transparency and will be handed to unknown software, use PNG. It is the universally understood answer and nothing will refuse it.',
        'If it is going onto the web and you control the page, WebP does the same job at a fraction of the size — transparency works in its lossy mode too, which is the thing JPEG cannot do at all and the reason people end up with unnecessarily large PNGs.',
        'And if the image genuinely has no transparency — a photograph, a screenshot with no cut-out areas — none of this applies, and JPEG or WebP will serve you better than a large PNG. The question to ask is not which format is best, but whether this particular image has anything to lose.',
      ],
    },
  ],
  related: [
    'png-to-jpg',
    'png-to-webp',
    'svg-to-png',
    'webp-to-png',
    'gif-to-png',
  ],
  faq: [
    {
      question:
        'Why does my PNG have a white background after converting to JPEG?',
      answer:
        'JPEG has no alpha channel at all, so every transparent pixel must be given a real colour. The convention is to composite onto white. Convert to PNG or WebP instead if the transparency needs to survive.',
    },
    {
      question: 'Can I recover transparency from a JPEG?',
      answer:
        'No. The information was discarded when the JPEG was written; the formerly transparent pixels are now genuinely white. It has to be removed again by editing, or recovered from the original file.',
    },
    {
      question: 'Why are the edges of my GIF logo jagged?',
      answer:
        'GIF transparency is one bit per pixel — fully visible or fully invisible, with no partial values. The smooth semi-transparent band around a curved edge cannot be represented and gets rounded to hard pixels.',
    },
    {
      question: 'Does WebP support transparency?',
      answer:
        'Yes, in both its lossy and lossless modes. That is one of its main advantages: you get transparency without paying PNG file sizes for a photographic image.',
    },
  ],
};
