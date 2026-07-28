import type { Metadata } from 'next';

import { FaqSection } from '@/components/marketing/faq-section';
import { GENERAL_FAQ, SECURITY_FAQ } from '@/content/faq';
import { buildMetadata, faqSchema } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Frequently asked questions',
  description:
    'How file conversion works, how long files are stored, what happens to your metadata, and how uploads are verified and secured.',
  path: '/faq',
  keywords: [
    'file converter faq',
    'is online conversion safe',
    'file retention',
  ],
});

export default function FaqPage() {
  const all = [...GENERAL_FAQ, ...SECURITY_FAQ];

  return (
    <>
      <section className="surface-gradient border-b">
        <div className="container py-16 text-center sm:py-20">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Questions and answers
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            If something is not covered here, the contact form reaches a person.
          </p>
        </div>
      </section>

      <FaqSection entries={GENERAL_FAQ} heading="Using HexaConverter" />
      <div className="border-t bg-card/40">
        <FaqSection entries={SECURITY_FAQ} heading="Security and privacy" />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema([...all])),
        }}
      />
    </>
  );
}
