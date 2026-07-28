import 'server-only';

import { convertPdfToDocx } from '@/services/documents/pdf-to-docx.service';
import type {
  ConversionContext,
  ConversionEngine,
  ConversionOutcome,
} from '@/types/conversion';

/**
 * PDF to Word, exposed through the standard engine interface so it queues,
 * reports progress and downloads exactly like every other conversion.
 */
export const pdfTextEngine: ConversionEngine = {
  id: 'pdf-text',

  async run(context: ConversionContext): Promise<ConversionOutcome> {
    const result = await convertPdfToDocx(
      context.inputPath,
      context.outputPath,
      context.onProgress,
    );

    return {
      outputPath: result.outputPath,
      mime: result.mime,
      detail: result.detail,
    };
  },
};
