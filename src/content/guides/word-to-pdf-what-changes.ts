import type { Guide } from '@/content/guides/types';

export const wordToPdfWhatChanges: Guide = {
  slug: 'word-to-pdf-what-changes',
  title: 'Word to PDF: what survives, what moves and what disappears',
  metaTitle:
    'Converting Word to PDF: fonts, layout, tracked changes and what to check',
  description:
    'The conversion that looks simplest is the one that quietly shifts a line break and pushes your last paragraph onto a page of its own. Here is what actually happens, and what to look at afterwards.',
  published: '2026-08-22',
  topic: 'document',
  formats: ['docx', 'doc', 'odt', 'rtf', 'pdf', 'html', 'txt'],
  intro: [
    'A Word document and a PDF are opposites, and it is worth being clear about which way round. A DOCX describes a document that **reflows**: it stores the text and the rules for setting it, and the software works out where the lines break each time it opens the file. A PDF stores the answer — every glyph pinned to a fixed position on a fixed page.',
    'Converting from one to the other means committing to one particular set of answers. That is exactly why you send people PDFs, and exactly why the occasional surprise appears when you do.',
  ],
  sections: [
    {
      heading: 'Fonts are where the surprises come from',
      body: [
        'A document does not usually carry its own typefaces. It names them and relies on the machine opening it to have them. When it does not, the software substitutes something else — and substitutes rarely occupy exactly the same width per character.',
        'A slightly wider substitute means each line holds fewer words, which means more lines, which means content pushes down the page. A document that ended neatly at the bottom of page three can gain an orphaned final paragraph on page four. Nothing has broken; the text has simply been set in a different typeface from the one you were looking at.',
        'This is the single most common cause of "the PDF does not look like my document". It affects any conversion performed anywhere other than the machine the document was written on — including sending the DOCX to a colleague, who will see the same shift for the same reason.',
      ],
      callout: {
        title: 'How to avoid it entirely',
        body: 'Stick to widely available typefaces for anything that will be converted elsewhere, or embed the fonts in the document before converting. A document set in a common face converts identically everywhere.',
      },
    },
    {
      heading: 'What runs the conversion here',
      body: [
        '[Word to PDF](/tools/docx-to-pdf) runs through headless LibreOffice — the same engine behind the desktop office suite, not a lookalike parser written to approximate it. That matters for fidelity: it is a genuine office application reading the document the way an office application does.',
        'It handles ordinary documents faithfully. Where it can drift is on the elaborate: heavily designed layouts, unusual typography, complex tables that were already sitting near a page boundary. If the document is a report, a letter, a CV or an essay, expect it to come out exactly as you left it.',
        'The output is a real PDF rather than a picture of one. The text stays selectable and searchable, links remain clickable, and the fonts are embedded so it renders identically on a machine that has never seen them. That last point is the entire value of the format, and it is what separates a PDF made this way from one made by printing and scanning.',
      ],
    },
    {
      heading: 'What does not come across',
      body: [
        'Editorial metadata is the first thing to go, and it goes for a good reason — a PDF is a finished document, so the machinery of getting it finished has nowhere to live in it.',
      ],
      list: [
        '**Tracked changes** are resolved. What you get is the document in its current displayed state, not a record of how it got there.',
        '**Comments** generally do not survive into the page, which is usually what you want when sending a document out, and occasionally not what you expected.',
        '**Macros** are not carried across at all. A PDF cannot execute anything.',
        '**Editability**, obviously. Keep the DOCX as your master — a PDF is the thing you send, not the thing you work in.',
        '**Fields that update themselves**, such as automatic dates, are frozen at the value they held during conversion.',
      ],
    },
    {
      heading: 'Going the other way is much harder',
      body: [
        'People assume the reverse conversion is symmetrical. It is not, and the asymmetry is fundamental rather than a limitation of any particular tool.',
        'Going to PDF means throwing away structure you had. Coming back means inventing structure you do not have. A PDF holds glyphs at coordinates — it does not record that a line was a heading, that a block was a table, or that a page had two columns. All of that has to be inferred from position and size.',
        '[PDF to Word](/tools/pdf-to-docx) does that inference and does it reasonably: it measures the most common font size, takes it as body text, and promotes anything meaningfully larger into a real heading. But images are not carried into the document, tables arrive as their text rather than as tables, and multi-column layouts are flattened into a single flow. On prose the result is genuinely useful. On a designed layout, expect to be rebuilding it.',
      ],
    },
    {
      heading: 'Converting between office formats',
      body: [
        'Word, LibreOffice and the rest do not model documents identically, so [DOCX to ODT](/tools/docx-to-odt) and its relatives are translations rather than copies. Text, structure and ordinary formatting come across cleanly; the margins need care.',
        'RTF is worth understanding as a special case. It dates from 1987 and exists so that any word processor can open a file with its formatting broadly intact. Bold, italics, fonts and simple tables survive [conversion to RTF](/tools/docx-to-rtf). Modern structure does not — tracked changes, comments and embedded objects tend to be dropped or flattened. It is a format for interchange with something old, not a working format.',
        'The legacy binary formats — DOC, XLS, PPT — are worth converting away from if you are keeping anything long term. Microsoft replaced them in 2007, and recent versions of Office block them by default on security grounds, because the old binary container can carry macros in ways that are hard to inspect.',
      ],
    },
    {
      heading: 'What to check before sending',
      body: [
        'A thirty-second review catches essentially everything that goes wrong with this conversion. Look at the page count first — if it differs from the original, a font substitution has changed the line breaking, and something has moved.',
        'Then check the last page for orphaned content, any table that sat near a page break, and the headers and footers. Finally, try selecting a paragraph: if the text selects normally, you have a genuine text PDF, which means it is searchable and will survive being converted again later.',
      ],
    },
  ],
  related: [
    'docx-to-pdf',
    'pdf-to-docx',
    'docx-to-odt',
    'docx-to-rtf',
    'odt-to-pdf',
  ],
  faq: [
    {
      question: 'Why does my PDF have more pages than the Word document?',
      answer:
        'Almost always a font substitution. If the converting machine lacks a typeface the document names, it substitutes another, and a slightly wider one means fewer words per line, more lines, and content pushed onto an extra page.',
    },
    {
      question: 'Do tracked changes and comments appear in the PDF?',
      answer:
        'No. The conversion produces the document in its current displayed state. Keep the original if the revision history matters to you.',
    },
    {
      question: 'Can I edit a PDF by converting it back to Word?',
      answer:
        'Up to a point. The text and paragraph structure come back well; images, tables and multi-column layouts do not. It works well for prose and poorly for designed documents.',
    },
    {
      question: 'Is the text in the converted PDF searchable?',
      answer:
        'Yes. The words remain real text rather than a picture, so the PDF can be searched, selected and copied, and converted onward later.',
    },
  ],
};
