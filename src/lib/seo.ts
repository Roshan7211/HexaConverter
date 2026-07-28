import type { Metadata } from 'next';

import { clientEnv } from '@/lib/env';

/**
 * Metadata and structured-data helpers.
 *
 * Every page composes its metadata through `buildMetadata` so canonical URLs,
 * Open Graph images and titles stay consistent, and search engines see one
 * authoritative URL per route.
 */

export const SITE = {
  name: clientEnv.appName,
  url: clientEnv.appUrl,
  tagline: 'Convert any file, right in your browser',
  description:
    'Convert documents, images, video, audio and archives online. Fast, private and free to start — no software to install, no watermarks, and files are deleted automatically.',
  locale: 'en_US',
  twitter: '@hexaconverter',
} as const;

export interface BuildMetadataInput {
  title: string;
  description: string;
  /** Path beginning with `/`. Used for the canonical URL. */
  path: string;
  keywords?: string[];
  noIndex?: boolean;
  /** Overrides the generated Open Graph image path. */
  ogImage?: string;
  type?: 'website' | 'article';
}

export function buildMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  ogImage,
  type = 'website',
}: BuildMetadataInput): Metadata {
  const canonical = new URL(path, SITE.url).toString();
  const image = ogImage ?? '/opengraph-image';

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      type,
      url: canonical,
      title,
      description,
      siteName: SITE.name,
      locale: SITE.locale,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    logo: new URL('/brand/mark.png', SITE.url).toString(),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      url: new URL('/contact', SITE.url).toString(),
      availableLanguage: ['English'],
    },
  };
}

export function webApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    url: SITE.url,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern browser with JavaScript enabled',
    description: SITE.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use, with no paid tier and no account required',
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE.url).toString(),
    })),
  };
}

export function faqSchema(
  entries: Array<{ question: string; answer: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

export function howToSchema(input: {
  name: string;
  description: string;
  steps: Array<{ name: string; text: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: input.name,
    description: input.description,
    totalTime: 'PT1M',
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function softwareApplicationSchema(input: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: input.name,
    description: input.description,
    url: new URL(input.path, SITE.url).toString(),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
}
