import { Fragment } from 'react';

import Link from 'next/link';

import { INLINE_SYNTAX, type GuideSection } from '@/content/guides/types';

/**
 * Renders guide prose.
 *
 * The content modules hold plain strings rather than JSX so that tests can read
 * them, count them and check the links in them. Three pieces of inline syntax
 * are supported — `[text](/path)`, `**text**` and `` `code` `` — and anything
 * else is rendered literally, which is the safe failure: an unhandled marker
 * shows up as an unhandled marker rather than silently disappearing.
 *
 * The code span exists because this content is largely about file formats, and
 * `.tar.gz`, `00123` and `1.23457E+15` all read badly as running prose. A test
 * asserts no unrendered marker survives into the output, which is how the first
 * batch of these was caught rendering with the backticks still showing.
 */

export function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE_SYNTAX)) {
    const index = match.index!;
    if (index > cursor) nodes.push(text.slice(cursor, index));

    const [, linkText, href, strong, code] = match;
    if (linkText && href) {
      nodes.push(
        <Link
          key={`${index}-link`}
          href={href}
          className="text-primary underline-offset-4 hover:underline"
        >
          {linkText}
        </Link>,
      );
    } else if (strong) {
      nodes.push(
        <strong
          key={`${index}-strong`}
          className="font-semibold text-foreground"
        >
          {strong}
        </strong>,
      );
    } else if (code) {
      nodes.push(
        <code
          key={`${index}-code`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {code}
        </code>,
      );
    }
    cursor = index + match[0].length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Paragraphs({ body }: { body: readonly string[] }) {
  return (
    <>
      {body.map((paragraph, index) => (
        <p key={index} className="mt-4 leading-relaxed text-muted-foreground">
          {renderInline(paragraph)}
        </p>
      ))}
    </>
  );
}

export function GuideSectionBlock({
  section,
  id,
}: {
  section: GuideSection;
  id: string;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight text-foreground"
      >
        {section.heading}
      </h2>

      <Paragraphs body={section.body} />

      {section.list ? (
        <ul className="mt-4 space-y-2 pl-5">
          {section.list.map((item, index) => (
            <li
              key={index}
              className="list-disc leading-relaxed text-muted-foreground"
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      ) : null}

      {section.table ? (
        // Wide tables scroll inside their own column rather than pushing the
        // page sideways on a phone.
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                {section.table.columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-4 font-semibold"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b align-top last:border-0">
                  {row.map((cell, cellIndex) => (
                    <Fragment key={cellIndex}>
                      {cellIndex === 0 ? (
                        <th
                          scope="row"
                          className="py-2.5 pr-4 text-left font-medium text-foreground"
                        >
                          {renderInline(cell)}
                        </th>
                      ) : (
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {renderInline(cell)}
                        </td>
                      )}
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.callout ? (
        <aside className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-foreground">
            {section.callout.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {renderInline(section.callout.body)}
          </p>
        </aside>
      ) : null}
    </section>
  );
}

export { Paragraphs as GuideParagraphs };
