import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { requirementPath, runCommand } from '@/services/conversion/binaries';
import { getFormat } from '@/services/conversion/registry';
import {
  ConversionError,
  type ConversionContext,
  type ConversionEngine,
  type ConversionOutcome,
} from '@/types/conversion';

/**
 * Office document conversion through headless LibreOffice.
 *
 * Each run gets a private `UserInstallation` profile so concurrent
 * conversions cannot corrupt a shared profile or serialise behind one lock —
 * this is the standard way to run `soffice` in a multi-worker server.
 */

const CONVERSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Export filters. The bare extension is ambiguous for several targets, so the
 * explicit filter name is given to guarantee the intended writer is used.
 */
const EXPORT_FILTERS: Record<string, string> = {
  pdf: 'pdf',
  docx: 'docx:MS Word 2007 XML',
  odt: 'odt:writer8',
  rtf: 'rtf:Rich Text Format',
  // `Text (encoded)` lets the charset be pinned to UTF-8.
  txt: 'txt:Text (encoded):UTF8',
  html: 'html:HTML (StarWriter)',
  xlsx: 'xlsx:Calc MS Excel 2007 XML',
  ods: 'ods:calc8',
  // Field delimiter 44 (comma), text delimiter 34 ("), charset 76 (UTF-8),
  // starting at row 1.
  csv: 'csv:Text - txt - csv (StarCalc):44,34,76,1',
  pptx: 'pptx:Impress MS PowerPoint 2007 XML',
  odp: 'odp:impress8',
};

/** Import filters for formats LibreOffice cannot detect unambiguously. */
const IMPORT_FILTERS: Record<string, string> = {
  csv: 'CSV:44,34,76,1',
};

export const officeEngine: ConversionEngine = {
  id: 'office',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const soffice = await requirementPath('libreoffice');
    if (!soffice) {
      throw new ConversionError(
        'Office document conversion is not available on this server. Contact support if this persists.',
        { retryable: true },
      );
    }

    const target = getFormat(context.targetFormat);
    const filter = EXPORT_FILTERS[context.targetFormat];
    if (!target || !filter) {
      throw new ConversionError(
        `Unsupported target format: ${context.targetFormat}`,
      );
    }

    const workDir = path.join(tmpdir(), `hexa-office-${randomUUID()}`);
    const outDir = path.join(workDir, 'out');
    const profileDir = path.join(workDir, 'profile');
    await mkdir(outDir, { recursive: true });
    await mkdir(profileDir, { recursive: true });

    context.onProgress(15);

    try {
      const args = [
        `-env:UserInstallation=file://${profileDir}`,
        '--headless',
        '--norestore',
        '--nolockcheck',
        '--nodefault',
        '--nofirststartwizard',
        '--nologo',
      ];

      const importFilter = IMPORT_FILTERS[context.sourceFormat];
      if (importFilter) args.push(`--infilter=${importFilter}`);

      args.push('--convert-to', filter, '--outdir', outDir, context.inputPath);

      context.onProgress(25);

      const result = await runCommand(soffice, args, {
        timeoutMs: CONVERSION_TIMEOUT_MS,
        cwd: workDir,
        signal: context.signal,
        // Keeps LibreOffice from probing a user's home directory.
        env: { HOME: workDir, SAL_USE_VCLPLUGIN: 'svp' },
      });

      context.onProgress(85);

      const produced = await findOutput(outDir, context.targetFormat);
      if (!produced) {
        throw new ConversionError(
          'The document could not be converted. It may be corrupt, password-protected or use an unsupported feature.',
          { cause: new Error(result.stdout || result.stderr) },
        );
      }

      await rename(produced, context.outputPath).catch(async (error) => {
        // `rename` fails across filesystems; fall back to a stream copy.
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
        const { copyFile } = await import('node:fs/promises');
        await copyFile(produced, context.outputPath);
      });

      context.onProgress(100);
      return { outputPath: context.outputPath, mime: target.mime };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  },
};

/** LibreOffice names its output after the input stem, so locate by extension. */
async function findOutput(
  outDir: string,
  targetFormat: string,
): Promise<string | null> {
  const entries = await readdir(outDir).catch(() => [] as string[]);
  const extension = `.${targetFormat}`;

  const match =
    entries.find((entry) => entry.toLowerCase().endsWith(extension)) ??
    // The HTML writer may emit `.html` for a target spelled `htm`, and Calc's
    // CSV writer emits `.csv`; fall back to the single produced file.
    (entries.length === 1 ? entries[0] : undefined);

  return match ? path.join(outDir, match) : null;
}
