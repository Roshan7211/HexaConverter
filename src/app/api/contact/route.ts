import { ok } from '@/api/responses';
import { contactSchema } from '@/api/schemas';
import { enforceRateLimit } from '@/middleware/with-rate-limit';
import { withErrorHandling } from '@/middleware/with-error-handling';
import { parseJsonBody } from '@/middleware/with-validation';
import { logger } from '@/lib/logger';
import { clientIp, hashIp } from '@/lib/security';
import { submitEnquiry } from '@/services/mail/contact.service';

/**
 * POST /api/contact
 *
 * Persists an enquiry and forwards it to the support inbox when SMTP is
 * configured.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withErrorHandling('POST /api/contact', async (request) => {
  const limited = enforceRateLimit('contact', request);
  if (limited) return limited;

  const body = await parseJsonBody(request, contactSchema);
  if (!body.success) return body.response;

  const { website, ...enquiry } = body.data;

  // Honeypot hit: accept silently so the bot sees no signal.
  if (website) {
    logger.info('Contact honeypot triggered');
    return ok({ received: true });
  }

  const { reference } = await submitEnquiry({
    ...enquiry,
    ipHash: hashIp(clientIp(request.headers)),
  });

  return ok({ received: true, reference }, { status: 201 });
});
