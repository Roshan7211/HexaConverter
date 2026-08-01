import { NextResponse } from 'next/server';

/**
 * The single JSON envelope every route handler answers with.
 *
 * Keeping construction here means an error shape can never drift between
 * endpoints, and no internal detail (stack trace, driver message, SQL) can leak
 * through an ad-hoc response.
 */

export interface ApiErrorBody {
  /** Human-readable message, safe to render directly to the end user. */
  error: string;
  /** Stable machine-readable code for client-side branching. */
  code: string;
  /** Field-level messages for form rendering. */
  fields?: Record<string, string>;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

export function fail(
  status: number,
  code: string,
  message: string,
  extra?: { fields?: Record<string, string>; headers?: HeadersInit },
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(extra?.fields ? { fields: extra.fields } : {}),
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store', ...(extra?.headers ?? {}) },
    },
  );
}

/** Named constructors for every status this API is allowed to return. */
export const errors = {
  badRequest: (message = 'The request could not be processed.') =>
    fail(400, 'bad_request', message),
  unauthorized: (message = 'Valid credentials are required.') =>
    fail(401, 'unauthorized', message),
  forbidden: (message = 'You do not have access to this resource.') =>
    fail(403, 'forbidden', message),
  notFound: (message = 'Not found.') => fail(404, 'not_found', message),
  conflict: (message: string) => fail(409, 'conflict', message),
  payloadTooLarge: (message: string) => fail(413, 'payload_too_large', message),
  unsupportedMedia: (message: string) =>
    fail(415, 'unsupported_media_type', message),
  unprocessable: (message: string, fields?: Record<string, string>) =>
    fail(422, 'unprocessable_entity', message, { fields }),
  tooManyRequests: (message: string, headers?: HeadersInit) =>
    fail(429, 'rate_limited', message, { headers }),
  server: (message = 'Something went wrong on our side. Please try again.') =>
    fail(500, 'internal_error', message),
  unavailable: (message: string) => fail(503, 'service_unavailable', message),
};
