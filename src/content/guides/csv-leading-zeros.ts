import type { Guide } from '@/content/guides/types';

export const csvLeadingZeros: Guide = {
  slug: 'why-csv-loses-leading-zeros-and-mangles-dates',
  title: 'Why your CSV lost its leading zeros',
  metaTitle:
    'CSV to Excel: why leading zeros vanish, dates change and IDs become 1.23E+15',
  description:
    'A CSV is text with no types, and a spreadsheet has to guess what each column means. That guess is where postcodes, product codes and dates quietly get damaged.',
  published: '2026-08-22',
  topic: 'document',
  formats: ['csv', 'xlsx', 'json', 'ods'],
  intro: [
    'You export a list of product codes as a CSV. Every code begins with a zero. You open it in a spreadsheet and the zeros are gone — `00123` has become `123`, and a column of identifiers that used to line up neatly is now a column of ordinary numbers that no longer match anything in your system.',
    'Nothing corrupted the file. The CSV on disk still says `00123`. The problem is that a CSV cannot say what kind of thing `00123` is, so anything that opens one has to guess — and the guess is wrong in a small number of predictable, damaging ways.',
  ],
  sections: [
    {
      heading: 'A CSV has no types at all',
      body: [
        'A CSV file is text. It contains rows, and within each row, values separated by commas. That is the whole format. There is nothing in it that says "this column contains numbers" or "this column contains dates" or "treat this one as text no matter what it looks like".',
        'A spreadsheet, by contrast, is strongly typed. Every cell is a number, a date, a piece of text, a boolean or a formula, and the type governs how it is stored, displayed, sorted and calculated. So the moment a CSV is opened in a spreadsheet, something has to decide which type each value is, using the only evidence available: what the value looks like.',
        '`00123` looks like a number. Read as a number it is 123, and the leading zeros are not part of the value — they were formatting, and the formatting was never recorded. The zeros are not stripped out of malice or carelessness; they simply have no meaning in a number.',
      ],
    },
    {
      heading: 'The four that bite',
      body: [
        'Almost all of the damage falls into four categories, and all four hit identifiers rather than actual measurements — which is why the problem so often surfaces in the columns you least want damaged.',
      ],
      list: [
        '**Leading zeros disappear.** Postcodes, product codes, telephone numbers, bank sort codes, employee IDs. Anything where the zero is part of the identity rather than part of the arithmetic.',
        '**Long numbers become scientific notation.** A 16-digit reference like `1234567890123456` exceeds the precision a spreadsheet keeps for numbers and is displayed as `1.23457E+15`. Worse, the trailing digits are genuinely lost, not merely hidden — converting the cell back to text afterwards does not bring them back.',
        '**Ambiguous dates get reinterpreted.** `03/04` is the third of April or the fourth of March depending on where the software thinks it is. `2026-08-22` is usually safe; almost every other format is a coin toss.',
        '**Things that merely resemble dates become dates.** The gene name `SEPT1` famously became `1-Sep` in enough published research that the field renamed the genes. Product codes like `1-2` and `MAR3` hit the same trap.',
      ],
    },
    {
      heading: 'What our converter does, and what it cannot do',
      body: [
        'When you [convert a CSV to XLSX](/tools/csv-to-xlsx) here, values that read as numbers are written as numbers and everything else stays text. The output is a genuine workbook rather than a renamed CSV: the first row is treated as a header, set in bold and frozen so it stays visible while you scroll, and the column widths are set from the header text.',
        'What no converter can do is know that your `00123` was meant to be a code rather than a quantity. That information was never in the CSV. Any tool that promises to always get this right is either guessing with more confidence or has been told the answer by you.',
        'So the honest advice is to check, not to trust. After converting, look at exactly the columns that hold identifiers — codes, references, postcodes, phone numbers — and confirm they still say what they said before. That takes ten seconds and catches essentially every instance of this problem.',
      ],
      callout: {
        title: 'The columns to check',
        body: 'Anything you would never perform arithmetic on. If adding two values together would be meaningless, the column is an identifier and deserves a look.',
      },
    },
    {
      heading: 'How to stop it happening in the first place',
      body: [
        'If you control what produces the CSV, the most reliable fix is at that end. Several options work, in rough order of how well they hold up.',
      ],
      list: [
        'Export to XLSX directly instead of CSV, so the types are recorded in the file and nothing has to be guessed.',
        'Use JSON when the data is going to a program rather than a person — JSON distinguishes the number 42 from the string "42" explicitly, which is exactly what CSV cannot do.',
        "Prefix values with an apostrophe (`'00123`) if the destination is specifically Excel. It is a spreadsheet convention rather than a CSV one, so it will look like a stray character elsewhere.",
        'Use ISO dates (`2026-08-22`) everywhere. They are unambiguous in every locale and sort correctly as plain text.',
        'Never let a spreadsheet be the intermediate step in an automated pipeline. If a CSV has to become another CSV, do it with something that does not infer types at all.',
      ],
    },
    {
      heading: 'Going the other way loses different things',
      body: [
        'The reverse conversion has its own losses, and they are worth knowing before you [export a workbook as CSV](/tools/xlsx-to-csv). A CSV is a single table of plain values, so three things go:',
        'Formulas are replaced by whatever they had last calculated. That is almost always what you want from an export, but it means the result is a snapshot — nothing in it recalculates, and a workbook saved without being recalculated exports whatever stale values it was holding.',
        'Only one sheet comes across, because the format has no concept of a second one. And all formatting disappears: colours, column widths, conditional highlighting, charts. If any of that was carrying meaning — a red cell indicating a problem, say — that meaning is not in the CSV.',
      ],
    },
    {
      heading: 'Why CSV is still worth using',
      body: [
        'None of this makes CSV a bad format. It is the most portable data format in existence: readable by every language, every database, every spreadsheet and a human being with a text editor, and it will still open in fifty years. That is not a small thing.',
        'The failure mode is specific and narrow. CSV does not record types, so whatever opens it has to infer them. Knowing that, and checking your identifier columns after any round trip, is the entire discipline. Use [JSON](/tools/csv-to-json) when a program needs the types to be explicit, and a real workbook when a person needs the formatting — and keep CSV for what it is genuinely unbeatable at, which is moving a table from anything to anything.',
      ],
    },
  ],
  related: [
    'csv-to-xlsx',
    'xlsx-to-csv',
    'csv-to-json',
    'json-to-csv',
    'xlsx-to-json',
  ],
  faq: [
    {
      question: 'How do I stop Excel removing leading zeros from a CSV?',
      answer:
        'Do not open the CSV directly. Use the import flow and mark the affected columns as Text, or convert the file to XLSX first so the types are stored in the file rather than guessed at open time.',
    },
    {
      question: 'Why did my long ID number turn into 1.23E+15?',
      answer:
        'It exceeded the precision a spreadsheet keeps for numeric values. The display can be changed, but the trailing digits are genuinely lost rather than hidden — the value has to be treated as text from the start to survive.',
    },
    {
      question: 'Does converting CSV to XLSX fix the leading zero problem?',
      answer:
        'It fixes it going forward, because a workbook records types explicitly and nothing has to be guessed again. It cannot recover zeros already lost in an earlier round trip — go back to the original CSV, which still has them.',
    },
    {
      question: 'Is JSON a better choice than CSV?',
      answer:
        'For data going to a program, usually yes: JSON records types explicitly and handles nested structure. For data going to a person, or into a spreadsheet, CSV or XLSX is easier to work with.',
    },
  ],
};
