import type { Guide } from '@/content/guides/types';

export const pngVsJpegFileSize: Guide = {
  slug: 'why-png-files-are-bigger-than-jpeg',
  title: 'Why your PNG is so much bigger than your JPEG',
  metaTitle:
    'Why PNG files are bigger than JPEG — and when the size is worth paying',
  description:
    'The same photograph can be 300 KB as a JPEG and 4 MB as a PNG. Here is what each format is actually doing, and how to tell which one your file wants to be.',
  published: '2026-08-22',
  topic: 'image',
  formats: ['png', 'jpg', 'webp', 'bmp'],
  intro: [
    'Convert a photograph from JPEG to PNG and you will usually watch it grow by a factor of ten. Nothing has gone wrong, and the PNG is not higher quality for being larger — in fact it looks exactly the same as the JPEG it came from, because it is a faithful copy of a file that had already thrown detail away.',
    "The confusion is worth clearing up, because it decides which format you should be reaching for. These two are not competitors at different quality levels. They were built for different kinds of picture, and each one is close to useless at the other one's job.",
  ],
  sections: [
    {
      heading: 'JPEG is allowed to lie, and PNG is not',
      body: [
        'JPEG compresses by discarding information. It breaks the image into blocks, works out which details your eye is least likely to notice, and throws those away permanently. That is what "lossy" means, and it is astonishingly effective on photographs: a camera image can lose 90% of its data before most people can see any difference at all.',
        'PNG does the opposite. It looks for patterns — runs of identical pixels, rows that resemble the row above — and stores them more compactly. Every pixel it stores comes back exactly as it went in. That is what "lossless" means, and on the right image it works very well indeed. A screenshot of a text document is mostly white with a few thousand black pixels arranged in repeating shapes, and PNG can describe that in very little space.',
        'Point PNG at a photograph, though, and there are no patterns to find. Every pixel in a photograph of a face differs slightly from its neighbours: skin, hair and sky are made of gradual variation and sensor noise. PNG cannot discard any of it, so it stores nearly all of it, and the file is enormous.',
      ],
    },
    {
      heading: 'Which is why converting a JPEG to PNG helps nothing',
      body: [
        'This is the trap people fall into. Your JPEG looks slightly soft, or it has visible blocking around the edges, so you convert it to a lossless format hoping to clean it up. What you get back is a much larger file containing exactly the same softness and exactly the same blocking, stored perfectly.',
        'Lossless means "preserves", not "restores". Detail that JPEG discarded when the file was made is gone from the file. No conversion can reason its way back to what the camera originally saw, because the information is not there to be recovered.',
        'There is one good reason to make that conversion anyway: you are about to edit. Every time a JPEG is opened, changed and saved again, it goes through the lossy process afresh and loses a little more. If you are going to make a dozen edits, converting to PNG first means the next dozen saves cost you nothing. Convert back to JPEG at the end.',
      ],
      callout: {
        title: 'The one-line version',
        body: 'Convert to a lossless format before you start editing, and back to a lossy one when you publish. Never convert to lossless hoping to improve a file that is already lossy.',
      },
    },
    {
      heading: 'Transparency is the other half of the answer',
      body: [
        'JPEG has no alpha channel. It cannot record that part of an image is transparent, at all, in any variant. PNG has a full 8-bit alpha channel, meaning each pixel can be anything from completely solid to completely invisible, with 254 gradations in between for the edges.',
        'That single difference decides an enormous number of format choices. A logo that has to sit on a coloured background needs alpha, so it needs PNG, and the file size question does not arise — JPEG simply cannot do the job. Convert that logo to JPEG and the transparent area has to become some solid colour, which in our converter means white. On a white page you will not notice. On anything else you get a white box around your logo.',
      ],
    },
    {
      heading: 'How to tell which one your image wants',
      body: [
        'The useful question is not "which format is better" but "does this image have large areas of flat, identical colour?" If yes, PNG will compress it well and keep it sharp. If no — if it is continuous tone, like a photograph — JPEG will be dramatically smaller and you will not see the difference.',
      ],
      table: {
        columns: ['What you have', 'Reach for', 'Why'],
        rows: [
          [
            'Photograph, camera output',
            'JPEG',
            'Continuous tone compresses beautifully and losslessly stores nothing useful',
          ],
          [
            'Screenshot, especially with text',
            'PNG',
            'Flat colour and sharp edges; JPEG puts halos around every letter',
          ],
          [
            'Logo, icon, line art',
            'PNG',
            'Sharp edges and usually transparency',
          ],
          [
            'Anything that needs transparency',
            'PNG',
            'JPEG cannot represent it at all',
          ],
          [
            'Scan of a printed page',
            'PNG',
            'Mostly white, sharp text — and JPEG artefacts make text recognition worse',
          ],
          [
            'A photo you are about to edit repeatedly',
            'PNG while working',
            'Avoids compounding loss on every save',
          ],
        ],
      },
    },
    {
      heading: 'Text is where JPEG visibly falls apart',
      body: [
        'It is worth seeing this one to believe it. JPEG works on blocks and assumes gradual change within them. A sharp black-to-white edge — which is what every letter of text is made of — violates that assumption completely, and the compression responds by scattering faint grey noise around the edge. This is called ringing, and once you have noticed it you will see it everywhere on the web.',
        'On a photograph of a landscape you will never spot it. On a screenshot of a spreadsheet it makes the whole image look grubby, and at small sizes it makes text genuinely harder to read. This is the single most common format mistake: saving a screenshot as JPEG to keep it small, then wondering why it looks worse than it did on screen.',
        'There is a related effect on colour. JPEG stores colour information at half resolution in each direction, because the eye is much more sensitive to brightness than to colour. On skin and sky this is invisible. On red text against white, or a thin coloured line, it produces visible fringing.',
      ],
    },
    {
      heading: 'WebP mostly ends the argument',
      body: [
        'WebP can compress either way. In lossy mode it does roughly what JPEG does but typically 25–35% smaller at comparable quality; in lossless mode it does roughly what PNG does, usually somewhat smaller. It supports transparency in **both** modes, which JPEG cannot do at all and which is the thing that most often forces people into large PNGs.',
        'If your images are for the web and you do not need to support software from before about 2020, WebP is very hard to argue against. You can [convert a PNG to WebP](/tools/png-to-webp) or [a JPEG to WebP](/tools/jpg-to-webp) and in most cases simply stop thinking about the question.',
        "The reasons to stay with the older pair are real but narrow: some desktop and print software still will not open WebP, and some clients and platforms specifically ask for JPEG or PNG. If you are handing a file to someone else's system, the boring format is often the correct one.",
      ],
    },
    {
      heading: 'What our converter does with the quality setting',
      body: [
        'When you convert to JPEG here, the default is quality 82, written with mozjpeg and stored progressively so the image renders in passes over a slow connection. Quality 82 is chosen deliberately: it is around the point where further increases stop being visible and start only adding bytes.',
        'When you convert to PNG, the default is maximum compression with adaptive filtering, and the result is fully lossless. Lowering the quality slider on a PNG does something different from lowering it on a JPEG — it switches the file to a 256-colour palette, which is a large change rather than a gentle one. Left alone, it stays at 100 and stays lossless.',
        'In both cases metadata is stripped unless you ask for it to be kept, so a photo you are about to share does not quietly carry the GPS coordinates of where it was taken.',
      ],
    },
  ],
  related: [
    'png-to-jpg',
    'jpg-to-png',
    'png-to-webp',
    'jpg-to-webp',
    'webp-to-png',
  ],
  faq: [
    {
      question: 'Does converting PNG to JPEG lose quality?',
      answer:
        'Yes — JPEG is lossy, so some detail is discarded permanently. At the default quality of 82 it is very hard to see on a photograph, and quite easy to see on a screenshot or anything containing text. The transparency is also lost, composited onto white.',
    },
    {
      question: 'Does converting JPEG to PNG improve quality?',
      answer:
        'No. It preserves exactly what the JPEG contained, including any compression artefacts, in a much larger file. It is worth doing only as a working format before editing, so that repeated saves do not degrade the image further.',
    },
    {
      question:
        'Why is my PNG screenshot smaller than a JPEG of the same thing?',
      answer:
        'Because a screenshot is mostly flat colour, which is exactly what PNG compresses well and exactly what JPEG handles badly. For screen content PNG is often both smaller and visibly sharper — the one case where you genuinely get to have it both ways.',
    },
    {
      question: 'Should I just use WebP for everything?',
      answer:
        "For images going on the web, largely yes — it covers both jobs and produces smaller files. Keep JPEG or PNG when you are sending a file to someone else's software, to a printer, or into a workflow that has told you what it wants.",
    },
  ],
};
