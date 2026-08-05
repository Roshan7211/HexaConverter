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

// Read here rather than hardcoded so the policy follows the project the build
// is actually configured against. Unset — the state before Firebase is wired
// up — leaves the policy exactly as strict as it was.
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

// Object storage, when the deployment uses it. With `STORAGE_DRIVER=s3` the
// download route redirects to a signed URL on the storage host, and a redirect
// is checked against the policy at its destination — so a converted image would
// be blocked from its own preview. Local storage streams the bytes from this
// origin and needs nothing here, which is why this stayed hidden: it only
// appears on S3 deployments.
const storageHost = (() => {
  if (process.env.STORAGE_DRIVER !== 's3') return '';
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return '';
  try {
    return ` ${new URL(endpoint).origin}`;
  } catch {
    return '';
  }
})();

// Likewise for payments: no Paddle token configured, no Paddle in the policy.
// `cdn.paddle.com` serves Paddle.js itself; the wildcard covers the checkout
// overlay and the endpoints it calls, which differ between sandbox and live
// and are not published as a fixed list.
const paddleHosts = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  ? ' https://cdn.paddle.com https://*.paddle.com'
  : '';

// Advertising is the largest deliberate widening of this policy, so it is tied
// to the publisher ID being set: a build without one keeps the policy exactly
// as strict as it was. AdSense serves the tag, the creatives and the frames
// from separate Google domains, and its consent tooling from a fourth.
const adsenseHosts = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  ? [
      'https://pagead2.googlesyndication.com',
      'https://*.googlesyndication.com',
      'https://*.googleadservices.com',
      'https://*.doubleclick.net',
      'https://*.google.com',
      'https://fundingchoicesmessages.google.com',
      // Called by the ad script at runtime for invalid-traffic checks. Not in
      // any of Google's published integration docs — found by loading real ads
      // and reading the violations.
      'https://*.adtrafficquality.google',
    ].join(' ')
  : '';
const ads = adsenseHosts ? ` ${adsenseHosts}` : '';

// Content-Security-Policy. `unsafe-inline` on styles is required by Tailwind's
// runtime-injected style attributes and Framer Motion's inline transforms.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob:${storageHost}${ads}`,
  "media-src 'self' blob:",
  "font-src 'self' data:",
  // Paddle serves the overlay's stylesheet from their CDN as well as the
  // script. Undocumented, and found by loading a real checkout and watching for
  // violations — without it the overlay opens completely unstyled.
  `style-src 'self' 'unsafe-inline'${paddleHosts}`,
  // Next.js injects a small inline bootstrap script; nonce-based CSP is not
  // compatible with static prerendering, so hashes/`unsafe-inline` are used and
  // scoped tightly to self.
  // Paddle.js is the one script deliberately loaded from a third party. Paddle
  // require it to come from their CDN rather than being bundled, so that a
  // security fix reaches every integration without anyone redeploying.
  process.env.NODE_ENV === 'production'
    ? `script-src 'self' 'unsafe-inline'${paddleHosts}${ads}`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'${paddleHosts}${ads}`,
  // Firebase Authentication talks to two Google endpoints from the browser:
  // `identitytoolkit` for sign-in, registration and profile changes, and
  // `securetoken` to exchange the refresh token roughly hourly. Without these
  // the SDK fails silently at the network layer and sign-in simply never
  // resolves. The SDK itself is bundled from npm, so `script-src` stays
  // `'self'` — nothing is fetched from a CDN.
  `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com${
    firebaseAuthDomain ? ` https://${firebaseAuthDomain}` : ''
  }${paddleHosts}${ads}`,
  // Google sign-in renders a helper iframe served from the Firebase auth
  // domain, and `accounts.google.com` inside it. Both are needed for the popup
  // and redirect flows; omit them and the provider button opens a blank frame.
  // Falls back to `'none'` when Firebase is not configured, which is the
  // current state and the stricter one.
  // The Paddle checkout is a cross-origin overlay iframe. Its own contents are
  // governed by Paddle's policy, not this one — all we have to permit is the
  // frame itself.
  firebaseAuthDomain || paddleHosts || ads
    ? `frame-src 'self'${
        firebaseAuthDomain
          ? ` https://${firebaseAuthDomain} https://accounts.google.com`
          : ''
      }${paddleHosts}${ads}`
    : "frame-src 'none'",
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
    // tesseract.js spawns a Node worker by path, resolved relative to its own
    // module location. Bundled, that path lands inside `.next/` where the
    // script does not exist and OCR dies with MODULE_NOT_FOUND the first time
    // it is used — after the pages have already been rendered, so the job sits
    // in PROCESSING rather than failing cleanly.
    'tesseract.js',
    'tesseract.js-core',
  ],

  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],

    // Next truncates a request body past this and carries on, so the route
    // receives the first N bytes of a file and nothing signals that the rest is
    // missing. A truncated PDF still starts with `%PDF`, passes the magic-byte
    // check, and then fails to parse — reported to the user as a corrupt or
    // password-protected document, which it is not.
    //
    // Kept a little above MAX_UPLOAD_BYTES (2 GB) so the application's own
    // limit is the one that rejects an oversized upload, with a message that
    // says so.
    //
    // Note this is a self-hosted setting. Vercel caps a serverless function's
    // request body at 4.5 MB regardless of what is configured here, so large
    // uploads there need the chunked session endpoints, not this route.
    middlewareClientMaxBodySize: 2100 * 1024 * 1024,
  },

  // Packages in `serverExternalPackages` are not bundled, so they have to be
  // traced out of node_modules instead — and the tracer misses three things
  // here, each of which fails only once deployed:
  //
  //   pdfjs is reached through `await import('pdfjs-dist/legacy/build/pdf.mjs')`.
  //   A deep dynamic path into an externalised package is not followed, so the
  //   whole build directory is listed explicitly. Without it every PDF route
  //   fails at run time while working perfectly in local builds.
  //
  //   The standard fonts are fetched by URL, not imported, so nothing links to
  //   them. Missing, pdfjs renders pages with every glyph absent — and only
  //   warns.
  //
  //   The canvas's native binary is an optional dependency picked by platform
  //   at require time; the linux build is never referenced from a machine that
  //   builds on macOS.
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/pdfjs-dist/legacy/**',
      './node_modules/pdfjs-dist/standard_fonts/**',
      './node_modules/@napi-rs/canvas/**',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      './node_modules/docx/**',
      // Same class of problem: the worker script and the WASM core are reached
      // by constructed path rather than by import, so nothing links to them and
      // the tracer leaves both behind.
      './node_modules/tesseract.js/**',
      './node_modules/tesseract.js-core/**',
    ],
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
