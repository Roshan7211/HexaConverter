import { CATEGORIES, type Category } from '@/types/conversion';
import { PDF_OPERATIONS, PDF_OPERATION_SPECS } from '@/types/documents';

/** Navigation model shared by the header, mobile drawer and footer. */

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

const CONVERTER_MENU: Record<Category, { label: string; description: string }> =
  {
    image: {
      label: 'Images',
      description: 'JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG',
    },
    document: {
      label: 'Documents',
      description: 'PDF, Word, Excel, PowerPoint, CSV',
    },
    audio: {
      label: 'Audio',
      description: 'MP3, WAV, FLAC, OGG, Opus, AAC, M4A',
    },
    video: {
      label: 'Video',
      description: 'MP4, WebM, MKV, MOV, AVI, animated GIF',
    },
    archive: { label: 'Archives', description: 'ZIP, TAR, TAR.GZ' },
  };

export const CONVERTER_LINKS: readonly NavLink[] = CATEGORIES.map(
  (category) => ({
    label: CONVERTER_MENU[category].label,
    href: `/convert/${category}`,
    description: CONVERTER_MENU[category].description,
  }),
);

/**
 * Document-toolkit entries, derived from the operation specs rather than
 * listed here — the same reason `CONVERTER_LINKS` is derived from
 * `CATEGORIES`. Adding an operation puts it in the menu; nothing can appear
 * here that the toolkit will not actually perform.
 */
export const PDF_TOOL_LINKS: readonly NavLink[] = PDF_OPERATIONS.map(
  (operation) => ({
    label: PDF_OPERATION_SPECS[operation].label,
    href: `/tools/pdf/${PDF_OPERATION_SPECS[operation].slug}`,
    description: PDF_OPERATION_SPECS[operation].description,
  }),
);

export const PRIMARY_LINKS: readonly NavLink[] = [
  { label: 'Features', href: '/features' },
  { label: 'FAQ', href: '/faq' },
];

/**
 * In-page anchors used by the header on the landing page only, where every
 * target actually exists on the current document.
 */
export const LANDING_SECTIONS: readonly NavLink[] = [
  { label: 'Features', href: '#features' },
  { label: 'Formats', href: '#formats' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

export const FOOTER_SECTIONS: readonly {
  title: string;
  links: readonly NavLink[];
}[] = [
  {
    title: 'Convert',
    links: CONVERTER_LINKS.map(({ label, href }) => ({ label, href })),
  },
  {
    title: 'PDF tools',
    links: [
      { label: 'Merge PDFs', href: '/tools/pdf/merge' },
      { label: 'Split PDF', href: '/tools/pdf/split' },
      { label: 'Compress PDF', href: '/tools/pdf/compress' },
      { label: 'Rotate PDF', href: '/tools/pdf/rotate' },
      { label: 'Extract pages', href: '/tools/pdf/extract-pages' },
      { label: 'PDF to Word', href: '/tools/pdf-to-docx' },
    ],
  },
  {
    title: 'Archive manager',
    links: [
      { label: 'Extract archive', href: '/tools/archive/extract' },
      { label: 'Create archive', href: '/tools/archive/compress' },
      { label: 'Password-protect a ZIP', href: '/tools/archive/protect' },
      { label: 'Convert archives', href: '/convert/archive' },
    ],
  },
  {
    title: 'Popular tools',
    links: [
      { label: 'PNG to JPG', href: '/tools/png-to-jpg' },
      { label: 'Word to PDF', href: '/tools/docx-to-pdf' },
      { label: 'PDF to JPG', href: '/tools/pdf-to-jpg' },
      { label: 'MP4 to MP3', href: '/tools/mp4-to-mp3' },
      { label: 'WebP to PNG', href: '/tools/webp-to-png' },
      { label: 'Excel to CSV', href: '/tools/xlsx-to-csv' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: '/legal/privacy' },
      { label: 'Terms of service', href: '/legal/terms' },
      { label: 'Cookie policy', href: '/legal/cookies' },
      { label: 'Delete your account', href: '/legal/account-deletion' },
    ],
  },
];
