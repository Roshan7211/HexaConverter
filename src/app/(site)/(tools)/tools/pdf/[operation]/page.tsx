import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { PdfWorkspace } from '@/components/documents/pdf-workspace';
import { FaqSection } from '@/components/marketing/faq-section';
import { Badge } from '@/components/ui/badge';
import {
  breadcrumbSchema,
  buildMetadata,
  faqSchema,
  howToSchema,
} from '@/lib/seo';
import {
  PDF_OPERATION_BY_SLUG,
  PDF_OPERATION_SPECS,
  type PdfOperation,
} from '@/types/documents';

/**
 * A page per document-toolkit operation.
 *
 * Statically generated with the workspace hydrating on top, so each one is a
 * proper indexable landing page for its own high-intent search term
 * ("merge pdf", "split pdf", …) rather than a tab inside an app shell.
 */

interface PageProps {
  params: Promise<{ operation: string }>;
}

export function generateStaticParams() {
  return Object.values(PDF_OPERATION_SPECS).map((spec) => ({
    operation: spec.slug,
  }));
}

export const dynamicParams = false;

function resolve(slug: string): PdfOperation | null {
  return PDF_OPERATION_BY_SLUG[slug] ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { operation: slug } = await params;
  const operation = resolve(slug);
  if (!operation) return {};

  const spec = PDF_OPERATION_SPECS[operation];

  return buildMetadata({
    title: `${spec.label} online — free, no watermark`,
    description: `${spec.description} Runs on our servers, no software to install, and your files are deleted automatically.`,
    path: `/tools/pdf/${spec.slug}`,
    keywords: [
      spec.label.toLowerCase(),
      `${spec.label.toLowerCase()} online`,
      `free ${spec.label.toLowerCase()}`,
      'pdf tools',
    ],
  });
}

const FAQ_FOR: Record<
  PdfOperation,
  Array<{ question: string; answer: string }>
> = {
  MERGE: [
    {
      question: 'Does the page order follow my file order?',
      answer:
        'Yes. Files are combined top to bottom exactly as listed, and you can rearrange them with the arrows before merging.',
    },
    {
      question: 'Is there a limit on how many PDFs I can merge?',
      answer:
        'Up to 30 files in one operation, each within the file-size limit.',
    },
  ],
  SPLIT: [
    {
      question: 'How do I get one file per page?',
      answer:
        'Leave the page selection as "all" and choose "One file per page". The results are delivered together as a ZIP.',
    },
    {
      question: 'Can I split out only certain pages?',
      answer:
        'Yes — enter a selection such as 1,4,7-9. Choosing "One file per range" keeps each consecutive run together in a single document.',
    },
  ],
  EXTRACT_PAGES: [
    {
      question: 'What happens to the pages I do not select?',
      answer:
        'They are discarded from the result. Your original upload is untouched and is deleted after the job finishes.',
    },
    {
      question: 'Can I reorder pages while extracting?',
      answer:
        'Yes. Pages come out in the order you list them, so 5,1,3 produces a document in that order.',
    },
  ],
  ROTATE: [
    {
      question: 'Can I rotate only some pages?',
      answer:
        'Yes. Enter a page selection such as 2,4-6; everything else is left alone.',
    },
    {
      question: 'Does it replace the existing rotation?',
      answer:
        'No, it adds to it. A page already turned 90° that you rotate 90° again ends up at 180°.',
    },
  ],
  COMPRESS: [
    {
      question: 'How much smaller will my PDF get?',
      answer:
        'It depends entirely on the document. Image-heavy scans shrink a lot; text-only files that are already optimised may barely change. The result shows the actual saving, and if compression would make the file larger the original is kept.',
    },
    {
      question: 'Does compression reduce quality?',
      answer:
        'The stronger settings downsample images, so yes — that is the trade. "Light" preserves print quality; "Strong" targets the smallest file for screen viewing.',
    },
  ],
};

export default async function PdfToolPage({ params }: PageProps) {
  const { operation: slug } = await params;
  const operation = resolve(slug);
  if (!operation) notFound();

  const spec = PDF_OPERATION_SPECS[operation];
  const others = Object.values(PDF_OPERATION_SPECS).filter(
    (candidate) => candidate.id !== operation,
  );
  const faq = FAQ_FOR[operation];

  return (
    <>
      <div className="border-b bg-card/40">
        <div className="container py-10 sm:py-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 text-sm text-muted-foreground"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href="/convert/document"
                  className="hover:text-foreground"
                >
                  Documents
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{spec.label}</li>
            </ol>
          </nav>

          <Badge variant="accent" className="mb-4">
            PDF tools
          </Badge>
          <h1 className="max-w-3xl text-balance text-3xl font-semibold sm:text-4xl">
            {spec.label}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {spec.description}
          </p>
        </div>
      </div>

      <div className="container py-10 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <PdfWorkspace operation={operation} />
        </div>
      </div>

      <section
        className="border-t bg-card/40 py-12"
        aria-labelledby="other-tools"
      >
        <div className="container mx-auto max-w-3xl">
          <h2 id="other-tools" className="text-sm font-semibold">
            Other PDF tools
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/tools/pdf/${other.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {other.label}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/tools/pdf-to-docx"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                PDF to Word
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <FaqSection entries={faq} heading={`${spec.label} questions`} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbSchema([
              { name: 'Home', path: '/' },
              { name: 'Documents', path: '/convert/document' },
              { name: spec.label, path: `/tools/pdf/${spec.slug}` },
            ]),
            howToSchema({
              name: spec.label,
              description: spec.description,
              steps: [
                { name: 'Upload', text: 'Drag your PDF into the upload area.' },
                {
                  name: 'Choose settings',
                  text: 'Adjust the options for this tool.',
                },
                {
                  name: 'Download',
                  text: 'Run the tool and download the result.',
                },
              ],
            }),
            faqSchema(faq),
          ]),
        }}
      />
    </>
  );
}
