import Link from 'next/link';

import { cn } from '@/utils';

/**
 * Shared shell for legal documents. Typography is applied with descendant
 * selectors so the page bodies stay plain, readable JSX.
 */
export function LegalPage({
  title,
  summary,
  lastUpdated,
  children,
}: {
  title: string;
  summary: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="border-b bg-card/40">
        <div className="container py-12 sm:py-16">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 text-sm text-muted-foreground"
          >
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{title}</li>
            </ol>
          </nav>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
            {summary}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated:{' '}
            <time dateTime={lastUpdated}>{formatDate(lastUpdated)}</time>
          </p>
        </div>
      </div>

      <article
        className={cn(
          'container max-w-3xl py-12',
          '[&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight',
          '[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold',
          '[&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground',
          '[&_li]:list-disc [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-muted-foreground',
          '[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline',
          '[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
          '[&_th]:border-b [&_th]:py-2 [&_th]:text-left [&_th]:font-medium',
          '[&_td]:border-b [&_td]:py-2 [&_td]:pr-4 [&_td]:text-muted-foreground',
        )}
      >
        {children}
      </article>
    </>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}
