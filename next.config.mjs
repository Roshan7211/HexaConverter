/** @type {import('next').NextConfig} */

/**
 * Whether this deployment is actually served over HTTPS.
 *
 * Two of the headers below are correct in production and actively break a
 * plain-HTTP origin: `Strict-Transport-Security` and the CSP's
 * `upgrade-insecure-requests` both tell the browser to use HTTPS for this host
 * from now on. Sent from `http://localhost:3000`, a browser pins the whole
 * hostname to HTTPS — for two years, in the case of that `max-age` — and then
 * refuses to load the site, because nothing is listening on HTTPS there.
 *
 * Safari enforces this for `localhost`; curl ignores it, which is exactly the
 * combination that makes it look like "the server is fine but the site is
 * down". Both headers are therefore gated on the canonical origin's scheme
 * rather than on NODE_ENV, since a production *build* is routinely run over
 * HTTP locally.
 */
const servedOverHttps = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
).startsWith('https://');

// Content-Security-Policy. `unsafe-inline` on styles is required by Tailwind's
// runtime-injected style attributes and Framer Motion's inline transforms.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // Next.js injects a small inline bootstrap script; nonce-based CSP is not
  // compatible with static prerendering, so hashes/`unsafe-inline` are used and
  // scoped tightly to self.
  process.env.NODE_ENV === 'production'
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  ...(servedOverHttps ? ['upgrade-insecure-requests'] : []),
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Only meaningful over HTTPS, and destructive over HTTP — see above.
  ...(servedOverHttps
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emits a self-contained server bundle for the Docker runtime stage.
  output: 'standalone',
  compress: true,
  productionBrowserSourceMaps: false,

  // Native/binary modules must not be bundled by the server compiler.
  serverExternalPackages: [
    'sharp',
    'fluent-ffmpeg',
    'ffmpeg-static',
    'ffprobe-static',
    'archiver',
    'node-stream-zip',
    'tar',
    'exceljs',
    'pdf-lib',
    // PDF.js resolves its worker relative to its own module URL, which webpack
    // rewrites — it has to be required natively at runtime.
    'pdfjs-dist',
    // Prebuilt .node binary, selected per platform at require time. Bundling it
    // breaks that lookup, and it is what lets PDF rasterisation run on hosts
    // without Poppler.
    '@napi-rs/canvas',
    'heic-decode',
    'docx',
    // 7zip-bin resolves its binary relative to its own path, and node-unrar-js
    // loads a .wasm file the same way; bundling either breaks that lookup.
    '7zip-bin',
    'node-unrar-js',
    '@prisma/client',
    'bcryptjs',
  ],

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  // The tracer follows `require`/`import`, so it finds pdfjs but not the font
  // files it loads by URL at run time. Without these, rasterisation on a
  // serverless host silently renders pages with every glyph missing.
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pdfjs-dist/standard_fonts/**'],
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
    // Every image is a local brand asset that only changes on deploy, so the
    // optimizer's default 60-second TTL just makes it re-encode the same PNG.
    minimumCacheTTL: 31536000,
    // The lockup and mark are the only images; the default ladder generates
    // several sizes that are never requested.
    imageSizes: [32, 48, 64, 96],
    deviceSizes: [640, 828, 1080, 1920],
  },

  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Immutable hashed assets.
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Everything except the public capability document, which sets its own
        // edge-cacheable header. A blanket rule here silently overrode it, so
        // `/api/formats` — identical for every visitor and changed only by a
        // deploy — was being revalidated on every converter page load.
        source: '/api/:path((?!formats$).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex' },
        ],
      },
      {
        source: '/api/formats',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ];
  },

  async redirects() {
    return [
      { source: '/convert', destination: '/convert/image', permanent: false },
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/register', destination: '/sign-up', permanent: true },
    ];
  },
};

export default nextConfig;
