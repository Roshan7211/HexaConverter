/**
 * Paddle configuration, shared by the browser and the server.
 *
 * Paddle is the merchant of record. It takes the payment, decides and collects
 * the right sales tax for wherever the buyer is, remits it, and pays out the
 * remainder — so none of that reasoning lives in this codebase, and there is no
 * VAT logic to get wrong.
 *
 * Nothing here is a secret. The client token is designed to be public: it can
 * open a checkout for a price that already exists and nothing else. The API key
 * and webhook secret are read separately, server-side only.
 */

export const PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
    ? 'production'
    : 'sandbox';

export const PADDLE_CLIENT_TOKEN =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '';

export const PADDLE_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ?? '';

/**
 * Whether checkout can be offered at all.
 *
 * Both values are needed: a token without a price opens an empty checkout, and
 * a price without a token cannot authenticate. When either is missing the
 * pricing page says Premium is unavailable rather than presenting a button that
 * fails when pressed.
 */
export const isPaddleConfigured = Boolean(
  PADDLE_CLIENT_TOKEN && PADDLE_PRICE_ID,
);

/**
 * Hosts the browser must be allowed to reach for checkout to work.
 *
 * Paddle does not publish a definitive CSP list, and the overlay is a
 * cross-origin iframe whose own contents are governed by Paddle's policy rather
 * than ours — so what this has to cover is the script, the frame and the calls
 * Paddle.js makes itself. Scoped to their domains rather than opened to `*`.
 */
export const PADDLE_CSP_HOSTS = [
  'https://cdn.paddle.com',
  'https://*.paddle.com',
] as const;
