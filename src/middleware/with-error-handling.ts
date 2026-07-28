import type { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { errors } from '@/api/responses';
import { fieldErrors } from '@/api/schemas';
import { logger } from '@/lib/logger';

/**
 * Outermost handler wrapper.
 *
 * Converts a validation failure into a 422 and anything else into a logged 500,
 * so an unexpected exception can never reach the client as a stack trace.
 */
export function withErrorHandling<Args extends unknown[]>(
  route: string,
  handler: (request: Request, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: Request, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = fieldErrors(error);
        return errors.unprocessable(
          Object.values(fields)[0] ?? 'Check the submitted values.',
          fields,
        );
      }

      logger.error('Unhandled API error', {
        route,
        method: request.method,
        error,
      });
      return errors.server();
    }
  };
}
