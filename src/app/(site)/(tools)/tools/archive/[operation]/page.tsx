import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { ArchiveWorkspace } from '@/components/archives/archive-workspace';
import { FaqSection } from '@/components/marketing/faq-section';
import { Badge } from '@/components/ui/badge';
import {
  breadcrumbSchema,
  buildMetadata,
  faqSchema,
  howToSchema,
} from '@/lib/seo';
import {
  ARCHIVE_OPERATION_BY_SLUG,
  ARCHIVE_OPERATION_SPECS,
  type ArchiveOperation,
} from '@/types/archives';

/**
 * A page per archive-manager operation.
 *
 * Statically generated with the workspace hydrating on top, so each one is an
 * indexable landing page for its own search term ("open rar", "password
 * protect zip") rather than a tab inside an app shell.
 */

interface PageProps {
  params: Promise<{ operation: string }>;
}

export function generateStaticParams() {
  return Object.values(ARCHIVE_OPERATION_SPECS).map((spec) => ({
    operation: spec.slug,
  }));
}

export const dynamicParams = false;

function resolve(slug: string): ArchiveOperation | null {
  return ARCHIVE_OPERATION_BY_SLUG[slug]?.id ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { operation: slug } = await params;
  const operation = resolve(slug);
  if (!operation) return {};

  const spec = ARCHIVE_OPERATION_SPECS[operation];

  return buildMetadata({
    title: `${spec.label} online — free, no software to install`,
    description: `${spec.description} Runs on our servers, and your files are deleted automatically.`,
    path: `/tools/archive/${spec.slug}`,
    keywords: [
      spec.label.toLowerCase(),
      `${spec.label.toLowerCase()} online`,
      'zip tool',
      'open rar online',
      '7z extractor',
    ],
  });
}

const FAQ_FOR: Record<
  ArchiveOperation,
  Array<{ question: string; answer: string }>
> = {
  EXTRACT: [
    {
      question: 'Which archive formats can be opened?',
      answer:
        'ZIP, RAR, 7Z, TAR, TAR.GZ and GZIP. If the archive holds one file you get that file back directly; if it holds several they are delivered together as a ZIP.',
    },
    {
      question: 'Can it open password-protected archives?',
      answer:
        'Yes, for ZIP, 7Z and RAR. Enter the password before running the tool. The password is used to decrypt the archive and is never stored.',
    },
    {
      question: 'Why can it read RAR but not create one?',
      answer:
        'RAR compression is proprietary — the format may legally be read by anyone, but only WinRAR can produce it. Choose 7Z instead: it usually compresses better.',
    },
  ],
  ARCHIVE: [
    {
      question: 'Which format should I choose?',
      answer:
        'ZIP if anyone else has to open it — every operating system reads it without extra software. 7Z if you want the smallest file. TAR.GZ if the files are headed for a Unix system.',
    },
    {
      question: 'What does the compression level change?',
      answer:
        'How hard the compressor works. 0 stores files without compressing at all, which is fast; 9 takes noticeably longer for a file that is usually only a little smaller. Already-compressed content such as JPEG or MP4 barely shrinks at any level.',
    },
    {
      question: 'Why can GZIP only take one file?',
      answer:
        'GZIP compresses a single stream and has no concept of directories or file names. That is exactly why TAR.GZ exists — TAR collects the files, GZIP compresses the result.',
    },
  ],
  PROTECT: [
    {
      question: 'Is the encryption real?',
      answer:
        'AES-256 is genuine, standard encryption: without the password the contents cannot be read. ZipCrypto, the alternative, is the original ZIP scheme from 1989 and is breakable — it is offered only because some built-in unzippers still cannot open AES archives.',
    },
    {
      question: 'What if I lose the password?',
      answer:
        'The archive cannot be opened. There is no recovery, no reset and no back door — that is what makes the encryption worth using.',
    },
    {
      question: 'Are the file names hidden too?',
      answer:
        'No. Encrypted ZIP hides the contents of each file, but the list of names stays readable. If the names themselves are sensitive, put everything in an inner archive first and protect that.',
    },
  ],
};

export default async function ArchiveToolPage({ params }: PageProps) {
  const { operation: slug } = await params;
  const operation = resolve(slug);
  if (!operation) notFound();

  const spec = ARCHIVE_OPERATION_SPECS[operation];
  const others = Object.values(ARCHIVE_OPERATION_SPECS).filter(
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
                <Link href="/convert/archive" className="hover:text-foreground">
                  Archives
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{spec.label}</li>
            </ol>
          </nav>

          <Badge variant="accent" className="mb-4">
            Archive manager
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
          <ArchiveWorkspace operation={operation} />
        </div>
      </div>

      <section
        className="border-t bg-card/40 py-12"
        aria-labelledby="other-tools"
      >
        <div className="container mx-auto max-w-3xl">
          <h2 id="other-tools" className="text-sm font-semibold">
            Other archive tools
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/tools/archive/${other.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {other.label}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/convert/archive"
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                Convert between formats
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
              { name: 'Archives', path: '/convert/archive' },
              { name: spec.label, path: `/tools/archive/${spec.slug}` },
            ]),
            howToSchema({
              name: spec.label,
              description: spec.description,
              steps: [
                {
                  name: 'Upload',
                  text: 'Drag your files into the upload area.',
                },
                {
                  name: 'Choose settings',
                  text: 'Pick the format, compression level or password.',
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
