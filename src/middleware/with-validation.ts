import type { NextResponse } from 'next/server';
import type { z } from 'zod';

import { errors, type ApiErrorBody } from '@/api/responses';
import { fieldErrors } from '@/api/schemas';

/**
 * Parses and validates a JSON body against a schema, with a hard size ceiling
 * so an oversized payload is rejected before it is parsed.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  maxBytes = 256 * 1024,
): Promise<
  | { success: true; data: z.infer<S> }
  | { success: false; response: NextResponse<ApiErrorBody> }
> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > maxBytes) {
    return {
      success: false,
      response: errors.payloadTooLarge('The request body is too large.'),
    };
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return {
        success: false,
        response: errors.payloadTooLarge('The request body is too large.'),
      };
    }
    raw = text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      response: errors.badRequest('The request body is not valid JSON.'),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    const first = Object.values(fields)[0] ?? 'Check the submitted values.';
    return { success: false, response: errors.unprocessable(first, fields) };
  }

  return { success: true, data: parsed.data };
}
