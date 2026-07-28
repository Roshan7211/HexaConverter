import { readFile, stat, writeFile } from 'node:fs/promises';

import ExcelJS from 'exceljs';

import { getFormat } from '@/services/conversion/registry';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
  type DocumentOptions,
} from '@/types/conversion';

/**
 * Spreadsheet and structured-data conversion (CSV / XLSX / JSON).
 *
 * Workbooks are parsed in-process, so an explicit size ceiling and cell budget
 * protect against inputs designed to exhaust memory.
 */

const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_CELLS = 2_000_000;

type Cell = string | number | boolean | null;
type Row = Cell[];

async function assertSize(path: string) {
  const stats = await stat(path);
  if (stats.size > MAX_INPUT_BYTES) {
    throw new ConversionError(
      'The spreadsheet is too large to convert. Files up to 50 MB are supported for tabular conversions.',
    );
  }
}

function normalizeCellValue(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) {
      const result = (value as { result?: unknown }).result;
      if (result === null || result === undefined) return null;
      if (
        typeof result === 'string' ||
        typeof result === 'number' ||
        typeof result === 'boolean'
      ) {
        return result;
      }
      return String(result);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('hyperlink' in value) {
      return String((value as { text?: string }).text ?? value.hyperlink ?? '');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function selectWorksheet(
  workbook: ExcelJS.Workbook,
  sheet: string | undefined,
): ExcelJS.Worksheet {
  if (sheet) {
    const byName = workbook.getWorksheet(sheet);
    if (byName) return byName;

    const index = Number(sheet);
    if (Number.isInteger(index)) {
      const byIndex = workbook.worksheets[index];
      if (byIndex) return byIndex;
    }
    throw new ConversionError(`The workbook has no sheet named "${sheet}".`);
  }

  const first = workbook.worksheets[0];
  if (!first) throw new ConversionError('The workbook contains no sheets.');
  return first;
}

function worksheetToRows(worksheet: ExcelJS.Worksheet): Row[] {
  const rows: Row[] = [];
  let cellCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: Row = [];
    const rowValues = row.values as ExcelJS.CellValue[];

    // exceljs uses 1-based indexing and leaves index 0 empty.
    for (let index = 1; index < rowValues.length; index += 1) {
      values.push(normalizeCellValue(rowValues[index] ?? null));
    }

    cellCount += values.length;
    if (cellCount > MAX_CELLS) {
      throw new ConversionError(
        'The spreadsheet exceeds the two-million-cell limit for tabular conversions.',
      );
    }
    rows.push(values);
  });

  return rows;
}

/** RFC 4180 CSV serialisation. */
function rowsToCsv(rows: Row[], delimiter: string): string {
  const needsQuoting = new RegExp(
    `["\\n\\r${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
  );

  const encodeCell = (cell: Cell): string => {
    if (cell === null) return '';
    const value = String(cell);
    return needsQuoting.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };

  return `${rows.map((row) => row.map(encodeCell).join(delimiter)).join('\r\n')}\r\n`;
}

function rowsToRecords(rows: Row[]): Array<Record<string, Cell>> {
  const [header, ...body] = rows;
  if (!header) return [];

  const keys = header.map((cell, index) =>
    cell === null || String(cell).trim() === ''
      ? `column_${index + 1}`
      : String(cell),
  );

  return body.map((row) => {
    const record: Record<string, Cell> = {};
    keys.forEach((key, index) => {
      record[key] = row[index] ?? null;
    });
    return record;
  });
}

function recordsToRows(input: unknown): Row[] {
  const records = Array.isArray(input)
    ? input
    : typeof input === 'object' &&
        input !== null &&
        Array.isArray((input as { data?: unknown }).data)
      ? (input as { data: unknown[] }).data
      : null;

  if (!records) {
    throw new ConversionError(
      'The JSON file must contain an array of objects, or an object with a "data" array.',
    );
  }
  if (records.length === 0) return [[]];

  const keys: string[] = [];
  for (const record of records) {
    if (
      typeof record !== 'object' ||
      record === null ||
      Array.isArray(record)
    ) {
      throw new ConversionError(
        'Every item in the JSON array must be an object so it can be mapped to a table row.',
      );
    }
    for (const key of Object.keys(record)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const rows: Row[] = [keys];
  for (const record of records) {
    const source = record as Record<string, unknown>;
    rows.push(
      keys.map((key) => {
        const value = source[key];
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') return JSON.stringify(value);
        if (typeof value === 'bigint') return Number(value);
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          return value;
        }
        return String(value);
      }),
    );
  }

  return rows;
}

async function readCsvRows(
  path: string,
  options: DocumentOptions,
): Promise<Row[]> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.readFile(path, {
    parserOptions: {
      delimiter: options.delimiter ?? ',',
      // Ragged rows are common in exported data; keep them rather than failing.
      discardUnmappedColumns: false,
      ignoreEmpty: false,
    },
  });
  return worksheetToRows(worksheet);
}

async function writeXlsx(
  rows: Row[],
  outputPath: string,
  sheetName = 'Sheet1',
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HexaConverter';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Sheet1');
  for (const row of rows) worksheet.addRow(row);

  const [header] = rows;
  if (header && header.length > 0) {
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.columns.forEach((column, index) => {
      const headerLength = String(header[index] ?? '').length;
      column.width = Math.min(60, Math.max(12, headerLength + 4));
    });
  }

  await workbook.xlsx.writeFile(outputPath);
}

export const spreadsheetEngine: ConversionEngine = {
  id: 'spreadsheet',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    await assertSize(context.inputPath);

    const { sourceFormat, targetFormat, options } = context;
    const target = getFormat(targetFormat);
    if (!target) {
      throw new ConversionError(`Unsupported target format: ${targetFormat}`);
    }

    context.onProgress(10);

    // --- Load the source into a common row matrix --------------------------
    let rows: Row[];

    if (sourceFormat === 'csv') {
      rows = await readCsvRows(context.inputPath, options);
    } else if (sourceFormat === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.readFile(context.inputPath);
      } catch (error) {
        throw new ConversionError(
          'The workbook could not be read. It may be corrupt or password-protected.',
          { cause: error },
        );
      }
      rows = worksheetToRows(selectWorksheet(workbook, options.sheet));
    } else if (sourceFormat === 'json') {
      const raw = await readFile(context.inputPath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        throw new ConversionError('The file does not contain valid JSON.', {
          cause: error,
        });
      }
      rows = recordsToRows(parsed);
    } else {
      throw new ConversionError(`Unsupported source format: ${sourceFormat}`);
    }

    context.onProgress(55);
    context.signal.throwIfAborted();

    // --- Emit the target --------------------------------------------------
    switch (targetFormat) {
      case 'csv':
        await writeFile(
          context.outputPath,
          rowsToCsv(rows, options.delimiter ?? ','),
          'utf8',
        );
        break;
      case 'json':
        await writeFile(
          context.outputPath,
          `${JSON.stringify(rowsToRecords(rows), null, 2)}\n`,
          'utf8',
        );
        break;
      case 'xlsx':
        await writeXlsx(rows, context.outputPath, options.sheet ?? 'Sheet1');
        break;
      default:
        throw new ConversionError(`Unsupported target format: ${targetFormat}`);
    }

    context.onProgress(100);
    return {
      outputPath: context.outputPath,
      mime: target.mime,
      detail: `${Math.max(0, rows.length - 1)} rows`,
    };
  },
};
