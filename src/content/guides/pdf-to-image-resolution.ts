import type { Guide } from '@/content/guides/types';

export const pdfToImageResolution: Guide = {
  slug: 'converting-pdf-pages-to-images',
  title: 'Turning PDF pages into images without regretting the resolution',
  metaTitle:
    'PDF to JPG or PNG: choosing DPI, picking a format and what gets lost',
  description:
    'A PDF page has no resolution until you render it. The number you choose at that moment is the one you are stuck with, so it is worth choosing deliberately.',
  published: '2026-08-22',
  topic: 'document',
  formats: ['pdf', 'jpg', 'png', 'tiff'],
  intro: [
    'A PDF does not contain pixels. It contains instructions — draw this letter here, in this typeface, at this size; stroke this line from here to there. A reader follows those instructions afresh every time you open the file, which is why you can zoom into a PDF indefinitely and the text stays crisp.',
    'Converting a page to an image ends that. The instructions are executed once, at one size, and the result is a fixed grid of pixels. Everything about the quality of what you get is decided by the resolution chosen at that single moment.',
  ],
  sections: [
    {
      heading: 'Resolution is a one-way door',
      body: [
        'This is the part worth internalising, because it is where people lose work. Rendering at too high a resolution costs you disk space, and you can always scale down later with no loss. Rendering at too low a resolution costs you detail that cannot be recovered — scaling back up only produces a larger, blurrier version of what you already have.',
        'The asymmetry means the safe error is to go higher than you think you need. If you are unsure, render larger. Storage is cheap and downscaling is free; re-rendering is only possible while you still have the PDF, and people routinely do not.',
      ],
      callout: {
        title: 'If you remember one thing',
        body: 'Choose the size before converting, not after — and when in doubt, choose the largest size you might ever need.',
      },
    },
    {
      heading: 'What DPI to use',
      body: [
        'DPI — dots per inch — describes how many pixels are produced for each inch of the original page. An A4 page is 8.27 inches wide, so at 150 DPI you get an image about 1240 pixels across, and at 300 DPI about 2480.',
      ],
      table: {
        columns: ['DPI', 'A4 width in pixels', 'Suitable for'],
        rows: [
          ['72–96', '~600–790', 'Thumbnails and small previews only'],
          ['150', '~1240', 'On-screen viewing, web pages, email attachments'],
          [
            '200–250',
            '~1650–2070',
            'Reading on a high-density display, or light zooming',
          ],
          [
            '300',
            '~2480',
            'Printing, archiving, and anything that will go through text recognition',
          ],
          ['600', '~4960', 'Fine detail work; produces very large files'],
        ],
      },
    },
    {
      heading: 'JPEG or PNG for the pages',
      body: [
        'The right choice depends entirely on what is on the page, and the usual instinct is wrong for documents.',
        'For a page of text, diagrams, tables or line art, use PNG. Those are exactly the things JPEG handles badly: it puts faint grey noise around every sharp black-to-white edge, and a page of text is nothing but sharp edges. The effect makes text look grubby at normal size and genuinely harder to read when zoomed. PNG is lossless, keeps letterforms crisp, and compresses flat white backgrounds extremely well — so for most documents it is both better looking **and** smaller.',
        'For a page that is mostly photographic — a magazine spread, a page dominated by a large image — JPEG will be substantially smaller and the artefacts will not be visible. TIFF is worth considering when the destination is a print or archival workflow that expects it, and it has the useful property of holding multiple pages in one file.',
      ],
    },
    {
      heading: 'What you give up by rendering at all',
      body: [
        'A PDF page is a stack of separate things — text, vector drawings, embedded photographs, form fields, annotations — kept distinct right up until it is displayed. Rendering collapses all of it into one flat layer.',
        'So the text stops being text: it cannot be selected, searched or copied, and a form field becomes a picture of a form field. Links stop working. Anything that was a vector drawing, and would have printed perfectly at any size, becomes pixels at the resolution you chose.',
        'And each page becomes a separate file. A PDF is inherently multi-page; JPEG and PNG each hold exactly one image, so [converting a ten-page PDF to JPEG](/tools/pdf-to-jpg) produces ten files. This is the most common surprise, and it is a property of the formats rather than a choice — TIFF is the exception, being the one image format here that can hold several pages.',
      ],
    },
    {
      heading: 'When you should not be doing this at all',
      body: [
        'Rendering to images is the right move for a preview, a thumbnail, something to paste into a slide, or a page to attach where the recipient cannot handle a PDF.',
        'It is the wrong move for three jobs people frequently attempt with it. If you want the text, [extract it directly](/tools/pdf-to-txt) — rendering to an image and reading it back is strictly worse, because it throws away text that was already there and then tries to guess it back from a picture.',
        'If you want to edit the document, [convert it to Word](/tools/pdf-to-docx) instead. And if you want a smaller PDF, rendering the pages to images and rebuilding a PDF from them will usually make the file **larger**, not smaller, while destroying the searchable text — compressing the PDF itself is the operation you actually want.',
      ],
    },
  ],
  related: [
    'pdf-to-jpg',
    'pdf-to-png',
    'pdf-to-tiff',
    'pdf-to-txt',
    'pdf-to-docx',
  ],
  faq: [
    {
      question: 'What DPI should I use to convert a PDF to an image?',
      answer:
        '150 DPI for on-screen use, 300 DPI for printing, archiving, or anything that will be run through text recognition. Going higher is safe but produces large files; going too low cannot be undone.',
    },
    {
      question: 'Should I convert PDF pages to JPG or PNG?',
      answer:
        'PNG for pages of text, tables and line art — JPEG puts visible noise around sharp edges, and PNG is usually both sharper and smaller for documents. JPEG for pages that are mostly photographic.',
    },
    {
      question: 'Why did my ten-page PDF produce ten images?',
      answer:
        'Because JPEG and PNG each hold exactly one image, while a PDF holds many pages. Every page has to become its own file. TIFF is the exception — it can hold multiple pages in a single file.',
    },
    {
      question: 'Can I convert the images back into a searchable PDF?',
      answer:
        'You can rebuild a PDF from them, but the text will not come back — the pages will be pictures. Recovering searchable text from images requires optical character recognition.',
    },
  ],
};
