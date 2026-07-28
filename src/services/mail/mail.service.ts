import nodemailer, { type Transporter } from 'nodemailer';

import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * SMTP delivery.
 *
 * Mail is optional: when `SMTP_HOST` is unset the transport is disabled and
 * callers fall back to persisting the message, which keeps local development
 * and minimal deployments working without credentials.
 */

let transporter: Transporter | null = null;
let initialised = false;

function getTransport(): Transporter | null {
  if (initialised) return transporter;
  initialised = true;

  const env = serverEnv();
  if (!env.SMTP_HOST) {
    logger.info('SMTP is not configured; outbound email is disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Implicit TLS on 465, STARTTLS elsewhere.
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    requireTLS: env.SMTP_PORT !== 465,
    pool: true,
    maxConnections: 3,
  });

  return transporter;
}

export function isMailEnabled(): boolean {
  return Boolean(serverEnv().SMTP_HOST);
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

/** Sends a message; returns false when mail is disabled or delivery failed. */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const transport = getTransport();
  if (!transport) return false;

  try {
    await transport.sendMail({
      from: serverEnv().MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      replyTo: message.replyTo,
    });
    return true;
  } catch (error) {
    logger.error('Failed to send email', { error, subject: message.subject });
    return false;
  }
}
