import type { Guide } from '@/content/guides/types';

export const presentationFormats: Guide = {
  slug: 'converting-presentations-without-breaking-them',
  title: 'Converting presentations without breaking them',
  metaTitle:
    'PowerPoint to PDF and ODP: fonts, animations, speaker notes and embedded video',
  description:
    'A slide deck carries more than the slides. Knowing which parts have somewhere to go in the destination format is the difference between a clean conversion and finding out on stage.',
  published: '2026-08-22',
  topic: 'document',
  formats: ['pptx', 'ppt', 'odp', 'pdf'],
  intro: [
    'Presentations are the most fragile documents to convert, and the reason is that a deck is not really one document. It is slides, plus speaker notes, plus timing and build order, plus embedded media, plus a set of typographic choices that were made visually and depend on exact positioning.',
    'Different destination formats have places to put different subsets of that. Knowing which is which before you convert is worth rather more here than it is for a text document, because presentation failures tend to be discovered in front of an audience.',
  ],
  sections: [
    {
      heading: 'What a deck is actually made of',
      body: [
        'Beyond the visible slide content, a presentation file typically holds several separate things.',
      ],
      list: [
        '**Speaker notes** — attached to each slide, never projected.',
        '**Animations and transitions** — the order things appear in, and what happens between slides.',
        '**Embedded or linked media** — video and audio, sometimes stored inside the file and sometimes only referenced.',
        '**Slide masters and layouts** — the templates governing where things sit on every slide.',
        '**Fonts**, which are usually named rather than embedded.',
      ],
    },
    {
      heading: 'Converting to PDF freezes everything',
      body: [
        '[PowerPoint to PDF](/tools/pptx-to-pdf) is the most common conversion here and the most predictable, because PDF simply cannot represent motion. Each slide becomes one page, in its final state.',
        'That last phrase matters more than it sounds. If a slide was built to reveal three bullet points on successive clicks, the PDF shows all three — which is fine. If it was built so that one block of text appears **on top of** another, the PDF shows both, overlapping and unreadable. Overlapping builds are the single most common way a deck converts badly, and they look completely correct in the editor.',
        'Speaker notes are not included in the pages. Embedded video becomes a still frame, or a blank rectangle where the video was. Neither is a defect — a PDF page has nowhere to put a video or a note.',
      ],
      callout: {
        title: 'Check for this one thing',
        body: 'Any slide with an animated build where elements occupy the same space. In the deck they appear in sequence; in the PDF they appear at once, on top of each other.',
      },
    },
    {
      heading: 'Converting between presentation formats',
      body: [
        'PPTX and ODP are the native formats of different office suites, and [converting between them](/tools/pptx-to-odp) is a translation rather than a copy. The conversion runs through headless LibreOffice, which is a genuine office application rather than an approximation of one, and ordinary decks come across cleanly.',
        'Where care is needed is the same place as always. Speaker notes usually survive between presentation formats — this is the main advantage of converting to ODP rather than PDF. Animations and transitions often survive in simplified form, since both formats have the concept but express it differently. Embedded video and audio are the fragile part: they are stored in suite-specific ways and are the most common thing to find missing afterwards.',
        'Check any deck that depends on media before presenting from the converted file, and keep the original until you have.',
      ],
    },
    {
      heading: 'The legacy PPT format',
      body: [
        'PPT is the pre-2007 binary format, superseded nearly two decades ago. Recent versions of Office block these files by default on security grounds, because the old binary container can carry macros in ways that are hard to inspect.',
        'If you have decks in this format that you intend to keep, [converting them to PPTX](/tools/ppt-to-pptx) is worth doing while software that reads them comfortably still exists. Macros are not carried across, which for a presentation is almost never a loss.',
        'Producing PPT is rarely the right choice. It is worth doing only when something genuinely old has to open the file — if the recipient is on any current version of Office, the modern format will open more reliably than the legacy one.',
      ],
    },
    {
      heading: 'Fonts move things, here more than anywhere',
      body: [
        'In a text document a substituted typeface shifts line breaks. In a presentation it shifts positions, and there is no reflow to absorb the difference — a heading set in a slightly wider substitute does not wrap, it overruns the edge of its box or collides with the graphic beside it.',
        'The conversion is typeset with the fonts the server has available. A deck built around a common typeface converts identically; one built around something distinctive may not. If a deck matters and uses an unusual face, either embed the fonts before converting or convert to PDF, where the fonts are baked into the file and nothing can substitute them afterwards.',
        "This is the strongest argument for presenting from a PDF when you are speaking on someone else's laptop: it is the only format that guarantees what you rehearsed is what appears.",
      ],
    },
    {
      heading: 'A practical routine before presenting',
      body: [
        'Convert to PDF for anything you are sending out for people to read, or presenting from a machine you do not control. Keep the editable deck as your master and never work in the PDF.',
        'If you need the notes to travel — sending a deck to a colleague who will present it — convert between presentation formats rather than to PDF, and confirm the notes arrived.',
        'Either way, open the converted file and page through it once. Look for overlapping builds, media that has become a blank rectangle, and any slide where text now sits outside its box. Those three account for almost every presentation conversion that goes wrong.',
      ],
    },
  ],
  related: [
    'pptx-to-pdf',
    'pptx-to-odp',
    'ppt-to-pptx',
    'odp-to-pdf',
    'odp-to-pptx',
  ],
  faq: [
    {
      question: 'Do animations survive when converting a presentation?',
      answer:
        'Not into PDF — a page cannot represent motion, so each slide is rendered in its final state. Between presentation formats they often survive in simplified form, since both have the concept but express it differently.',
    },
    {
      question: 'Are speaker notes included in the PDF?',
      answer:
        'No. The pages contain the slides only. If the notes need to travel, convert to another presentation format instead, which normally carries them.',
    },
    {
      question: 'Why do some slides look wrong after converting to PDF?',
      answer:
        'Usually an animated build where elements share the same space. In the deck they appear in sequence; in the PDF they are all shown at once, overlapping. It looks correct in the editor, which is why it is so easily missed.',
    },
    {
      question: 'What happens to embedded video?',
      answer:
        'In a PDF it becomes a still frame or a blank area, since a page cannot play anything. Between presentation formats it may survive, but embedded media is the most common casualty — check any deck that depends on it.',
    },
  ],
};
