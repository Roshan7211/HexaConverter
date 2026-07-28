import 'server-only';

import * as contacts from '@/database/repositories/contact.repository';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isMailEnabled, sendMail } from '@/services/mail/mail.service';

/**
 * Contact enquiries.
 *
 * The message is persisted before delivery is attempted, so an SMTP outage
 * loses nothing — the record is still in the database to follow up on.
 */
export async function submitEnquiry(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  ipHash: string;
}): Promise<{ reference: string }> {
  const record = await contacts.create(input);

  if (isMailEnabled()) {
    await sendMail({
      to: serverEnv().CONTACT_INBOX,
      subject: `[HexaConverter] ${input.subject}`,
      replyTo: input.email,
      text: [
        `From: ${input.name} <${input.email}>`,
        `Reference: ${record.id}`,
        '',
        input.message,
      ].join('\n'),
    });
  }

  logger.info('Contact message received', { messageId: record.id });
  return { reference: record.id };
}
