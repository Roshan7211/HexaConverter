import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';
import { organizationSchema, SITE, webApplicationSchema } from '@/lib/seo';

import '@/styles/globals.css';

/**
 * Root layout.
 *
 * Fonts are self-hosted through `next/font` (no third-party request at
 * runtime), and the two site-wide JSON-LD graphs are emitted once here rather
 * than repeated on every page.
 */

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: true,
});

// `optional` rather than `swap`, and preloaded rather than not.
//
// This font sets the format pills in the hero — above the fold, and the widest
// row on the page. Left to `swap` it was laid out in `ui-monospace` first and
// re-laid out when the real font arrived: the glyph widths change, the pills
// re-wrap, and every section below them — dropzone, file list, the lot — moves
// down the page. It was the largest layout shift on the site by some margin.
//
// `optional` gives the font one short window to arrive and then commits to
// whichever is in hand for that page view, so a swap can never reflow the page.
// `preload: true` is what makes it usually win that window; it was previously
// off, which is why it kept losing it.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'optional',
  variable: '--font-mono',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    'file converter',
    'online converter',
    'convert pdf',
    'image converter',
    'video converter',
    'audio converter',
    'document converter',
    'archive converter',
  ],
  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,
  formatDetection: { telephone: false, address: false, email: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: SITE.twitter,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0c0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh font-sans">
        {/* Chrome is chosen per route group: `(site)` wraps the public pages
            in the marketing header and footer, `(app)` in the dashboard shell. */}
        <Providers>
          {children}
          <Toaster />
        </Providers>

        <script
          type="application/ld+json"
          // Static, application-authored JSON-LD; no user input is interpolated.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              organizationSchema(),
              webApplicationSchema(),
            ]),
          }}
        />
      </body>
    </html>
  );
}
