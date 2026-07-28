import type { Metadata } from 'next';

import { CategoryGrid } from '@/components/marketing/category-grid';
import { FaqSection } from '@/components/marketing/faq-section';
import { Features } from '@/components/marketing/features';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { PopularTools } from '@/components/marketing/popular-tools';
import { SupportedFormats } from '@/components/marketing/supported-formats';
import { Testimonials } from '@/components/marketing/testimonials';
import { WhyChooseUs } from '@/components/marketing/why-choose-us';
import { GENERAL_FAQ } from '@/content/faq';
import { buildMetadata, faqSchema } from '@/lib/seo';
import { FORMATS, TOTAL_ROUTES } from '@/services/conversion/registry';

/**
 * Landing page.
 *
 * Statically generated in full. Only three fragments hydrate — the format
 * explorer's tabs, the scroll-reveal wrappers and the header — so the page
 * ships as HTML and paints before any JavaScript is needed.
 */

export const metadata: Metadata = buildMetadata({
  title: `Convert documents, images, video, audio and archives — ${TOTAL_ROUTES} free conversions`,
  description: `Free online file converter for PDF, Word, Excel, JPEG, PNG, WebP, MP4, MP3, ZIP and ${Object.keys(FORMATS).length} formats in total. Professional encoders, no watermarks, files deleted automatically.`,
  path: '/',
  keywords: [
    'file converter',
    'convert files online',
    'free online converter',
    'pdf converter',
    'image converter',
    'video converter',
    'audio converter',
    'document converter',
    'batch file conversion',
  ],
});

/** The home page shows a subset of the FAQ; the schema mirrors exactly that. */
const HOME_FAQ = GENERAL_FAQ.slice(0, 6);

export default function HomePage() {
  return (
    <>
      <Hero />
      <Features />
      <SupportedFormats />
      <HowItWorks />
      <WhyChooseUs />
      <Testimonials />
      <CategoryGrid />
      <PopularTools />

      <div id="faq">
        <FaqSection
          entries={HOME_FAQ}
          description="Everything you might want to check before uploading a file."
        />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            faqSchema(
              HOME_FAQ.map(({ question, answer }) => ({ question, answer })),
            ),
          ),
        }}
      />
    </>
  );
}
