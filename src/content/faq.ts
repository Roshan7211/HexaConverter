import type { FaqEntry } from '@/components/marketing/faq-section';
import { PLANS } from '@/lib/plans';
import { formatBytes } from '@/utils';

/** Canonical FAQ content, reused by the FAQ page and its structured data. */

export const GENERAL_FAQ: readonly FaqEntry[] = [
  {
    question: 'Do I need an account to convert a file?',
    answer: `No. Without one you get ${PLANS.ANONYMOUS.jobsPerPeriod} conversions a day at up to ${formatBytes(PLANS.ANONYMOUS.maxFileBytes, 0)} each. A free account raises that to ${PLANS.FREE.jobsPerPeriod} a month at ${formatBytes(PLANS.FREE.maxFileBytes, 0)}, keeps your history in one place and unlocks text recognition. Premium removes the limit entirely.`,
  },
  {
    question: 'How long are my files stored?',
    answer: `The source file is deleted as soon as its conversion finishes. The converted file is kept so you can download it — ${PLANS.ANONYMOUS.retentionHours} hour without an account, ${PLANS.FREE.retentionHours} hours with a free one, ${PLANS.PREMIUM.retentionHours} hours on Premium — then removed automatically by a scheduled cleanup job. You can also delete it yourself at any time.`,
  },
  {
    question: 'Is there a watermark on converted files?',
    answer:
      'Never. Output files contain exactly what the encoder produced, with no branding, overlays or injected metadata.',
  },
  {
    question: 'What happens to the metadata in my images?',
    answer:
      'Image metadata — EXIF, IPTC and XMP, including GPS coordinates and camera serial numbers — is stripped by default. You can keep it by turning off "Remove metadata" in the conversion settings.',
  },
  {
    question: 'How large a file can I convert?',
    answer: `${formatBytes(PLANS.ANONYMOUS.maxFileBytes, 0)} without an account, ${formatBytes(PLANS.FREE.maxFileBytes, 0)} with a free one, and ${formatBytes(PLANS.PREMIUM.maxFileBytes, 0)} on Premium. Very large media files take proportionally longer to encode, and the progress bar reports real progress rather than an estimate.`,
  },
  {
    question: 'Why did my conversion fail?',
    answer:
      'The most common causes are a password-protected document, a corrupt or truncated file, an archive containing unsafe paths, or a media file using a codec we cannot decode. The error shown on the file explains which applied — nothing is retried silently.',
  },
  {
    question: 'Can I convert several files at once?',
    answer: `Yes — ${PLANS.ANONYMOUS.maxBatchFiles} files in a batch without an account, ${PLANS.FREE.maxBatchFiles} with a free one, and ${PLANS.PREMIUM.maxBatchFiles} on Premium. Every file in a batch shares the same output format and settings, and each reports its own progress.`,
  },
  {
    question: 'Is my data used for anything else?',
    answer:
      'No. Files are used solely to perform the conversion you requested. They are not inspected, indexed, shared or used to train anything, and we store a salted hash of your IP address rather than the address itself.',
  },
  {
    question: 'What happens to a multi-page PDF when I convert it to an image?',
    answer:
      'Each page is rendered separately. A single-page PDF produces one image; a multi-page PDF produces one image per page, delivered together in a ZIP archive.',
  },
  {
    question: 'Can I cancel a conversion that is taking too long?',
    answer:
      'Yes. Use the cancel button on any queued or running file. The encoder is stopped, the partial output is discarded, and the conversion does not count towards your monthly allowance.',
  },
];

export const SECURITY_FAQ: readonly FaqEntry[] = [
  {
    question: 'Are my uploads encrypted?',
    answer:
      'Transfers use HTTPS with HSTS enforced. In production, files are stored in an S3-compatible bucket with server-side encryption at rest and no public read access.',
  },
  {
    question: 'Can someone else access my converted file?',
    answer:
      'Download links are signed with an HMAC bound to a single conversion and expire within minutes, so links cannot be guessed or enumerated. Conversions are also scoped to an anonymous cookie, so one visitor can never reach the files of another.',
  },
  {
    question: 'Do you scan uploads for malicious content?',
    answer:
      'Every upload is identified by its magic bytes and rejected if the contents do not match the extension. Archives are checked for path traversal entries and abnormal compression ratios before extraction. Conversions run as unprivileged processes with no network access and a fresh temporary directory per job.',
  },
];
