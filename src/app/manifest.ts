import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/seo';

/** Web app manifest for installable/standalone use. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description: SITE.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#fd6e08',
    orientation: 'portrait-primary',
    categories: ['utilities', 'productivity'],
    icons: [
      {
        src: '/brand/mark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Convert an image', url: '/convert/image' },
      { name: 'Convert a document', url: '/convert/document' },
      { name: 'Convert video', url: '/convert/video' },
    ],
  };
}
