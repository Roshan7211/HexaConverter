import type { Guide } from '@/content/guides/types';

export const scannedPdfNoText: Guide = {
  slug: 'why-a-scanned-pdf-has-no-text',
  title: 'Why you cannot copy text out of a scanned PDF',
  metaTitle:
    'Scanned PDFs explained: why there is no text to extract, and what OCR does',
  description:
    'Two PDFs can look identical and be completely different files. One contains text; the other contains a photograph of text. Only one of them can be searched, copied or converted to Word.',
  published: '2026-08-22',
  topic: 'document',
  formats: ['pdf', 'docx', 'txt', 'jpg', 'png', 'tiff'],
  intro: [
    'You open a PDF, try to select a paragraph, and the cursor refuses to behave like a cursor. Search finds nothing, even for words plainly visible on screen. Converting it to Word produces an empty document or fails outright.',
    'The file is not corrupt and nothing is protecting it. It simply does not contain any text. What it contains is a picture of a page that has text printed on it — and to a computer those are entirely unrelated things.',
  ],
  sections: [
    {
      heading: 'Two completely different kinds of PDF',
      body: [
        'A PDF created by exporting from a word processor is built from text. It records the characters, the font each one is set in, and the exact position of every glyph on the page. Software reading it can extract the characters, because the characters are what is stored.',
        'A PDF created by a scanner or a phone camera contains one image per page. The words are visible to you because your eyes read the shapes of letters. To the file, there are no letters — there is a grid of coloured pixels, some of which happen to be arranged in the shape of writing. There is nothing to select because nothing in the file knows the shapes are language.',
        'Both open in the same reader and both print identically. The difference only becomes visible the moment you try to do something with the content rather than look at it.',
      ],
      callout: {
        title: 'A thirty-second test',
        body: 'Try to select a line of text with your mouse. If you get a neat text selection, it is a text PDF. If you get a rectangle, or nothing at all, it is a scan.',
      },
    },
    {
      heading: 'What this means for conversion',
      body: [
        'Every text-based conversion depends on there being text. [PDF to Word](/tools/pdf-to-docx) reconstructs a document from the characters and their positions; [PDF to plain text](/tools/pdf-to-txt) extracts them directly. Neither can work on an image.',
        'Rather than hand you an empty file, a PDF-to-Word job on a scanned document stops and explains why. That is deliberate: an empty DOCX looks like a bug in the converter, when the actual situation is that the source contains nothing of the kind being asked for.',
        'Converting the other way — [PDF to JPEG](/tools/pdf-to-jpg) or PNG — works fine on either kind, because rendering a page to pixels does not care whether the page was made of text. You simply get an image of it.',
      ],
    },
    {
      heading: 'What OCR does, and what it costs',
      body: [
        'Optical character recognition is the missing step. It examines the image, identifies shapes that look like letters, and produces actual text from them. It is what turns a scan into something searchable.',
        'It is worth understanding that OCR is a recognition process, not an extraction one. It is making an informed guess about each character, and its accuracy depends heavily on the input. A clean 300 DPI scan of printed text in a common typeface will come out close to perfect. A photograph taken at an angle in poor light, or a page of handwriting, or a heavily stylised typeface, will not.',
        'The characteristic OCR errors are worth recognising when you see them: `rn` read as `m`, `1` and `l` and `I` confused with each other, `0` and `O` swapped. On a page of prose these are easy to spot. In a table of reference numbers they are much harder, which is exactly where they matter most.',
      ],
    },
    {
      heading: 'Getting a better scan in the first place',
      body: [
        'Recognition quality is decided almost entirely at the scanning stage, and a few habits make a large difference.',
      ],
      list: [
        'Scan at 300 DPI. Below that, letterforms lack the detail to be distinguished reliably; far above it, you get much larger files and little further accuracy.',
        'Keep the page square to the scanner. Skew is one of the biggest single causes of poor recognition.',
        'Use even lighting and avoid shadows if photographing rather than scanning — a shadow across a column can lose the whole column.',
        'Scan text as greyscale rather than colour. It is smaller and usually recognises better.',
        'Prefer a lossless format for the intermediate image. JPEG compression puts faint noise around every letter edge, which is precisely the detail recognition depends on.',
      ],
    },
    {
      heading: 'Why the reading order sometimes comes out wrong',
      body: [
        'Even with a genuine text PDF, extraction can produce text in an order that does not match what you see. This surprises people who assume the file must know how it reads.',
        'It does not. A PDF records that a run of characters sits at a particular position on the page. It does not record that those characters belong to the left column, or that the left column should be read before the right. Extraction follows the order in which the text was written into the file, which for a single-column document matches the visual order almost always.',
        'Multi-column layouts, sidebars, headers and tables are where it breaks down. A two-column academic paper can extract as alternating lines from both columns, because that may genuinely be the order the generator wrote them in. Nothing is malfunctioning — the information needed to do better was never recorded.',
        'This is also why [PDF to Word](/tools/pdf-to-docx) reconstructs rather than recovers. Headings are inferred by measuring which text is set larger than the body; tables arrive as their text rather than as tables; images are not carried across. On prose it works well. On a designed layout, expect to rebuild the structure.',
      ],
    },
  ],
  related: [
    'pdf-to-docx',
    'pdf-to-txt',
    'pdf-to-jpg',
    'pdf-to-png',
    'pdf-to-tiff',
  ],
  faq: [
    {
      question: 'Why can I not select text in my PDF?',
      answer:
        'Because the PDF contains an image of a page rather than text. This is what a scanner or a phone camera produces. The words are visible to you as shapes, but there are no characters stored in the file to select.',
    },
    {
      question: 'Can I convert a scanned PDF to Word?',
      answer:
        'Not directly — there is no text layer to work from, and the job stops with an explanation rather than producing an empty document. Run optical character recognition over it first, then convert the result.',
    },
    {
      question: 'Will converting a scanned PDF to an image help?',
      answer:
        'No. That produces pictures of the same pictures. Rendering works on any PDF, but it cannot create text that was never there.',
    },
    {
      question: 'Why is my extracted text in the wrong order?',
      answer:
        'A PDF records where text sits on the page, not which column or paragraph it belongs to. Extraction follows the order the text was written into the file, which matches the visual order for single-column documents and often does not for multi-column ones.',
    },
  ],
};
