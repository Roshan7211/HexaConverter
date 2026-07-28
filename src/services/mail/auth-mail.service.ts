import 'server-only';

import { clientEnv } from '@/lib/env';
import { sendMail } from '@/services/mail/mail.service';

/**
 * Account emails.
 *
 * Link construction lives here so every message points at the canonical app URL
 * and encodes its token exactly once — a token mangled into a query string is
 * indistinguishable, to the user, from an account problem.
 */

function linkTo(path: string, token: string): string {
  const url = new URL(path, clientEnv.appUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

/** Minutes/hours phrasing for a millisecond TTL. */
function humanTtl(ttlMs: number): string {
  const minutes = Math.round(ttlMs / 60_000);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export function sendPasswordResetEmail(input: {
  to: string;
  name: string | null;
  token: string;
  ttlMs: number;
}): Promise<boolean> {
  const link = linkTo('/reset-password', input.token);

  return sendMail({
    to: input.to,
    subject: `Reset your ${clientEnv.appName} password`,
    text: [
      `Hi${input.name ? ` ${input.name}` : ''},`,
      '',
      `Someone asked to reset the password for your ${clientEnv.appName} account.`,
      'Open the link below to choose a new one:',
      '',
      link,
      '',
      `The link works once and expires in ${humanTtl(input.ttlMs)}.`,
      '',
      'If this was not you, no action is needed — your password has not changed.',
      'Nobody can use this link without access to this mailbox.',
    ].join('\n'),
  });
}

export function sendVerificationEmail(input: {
  to: string;
  name: string | null;
  token: string;
  ttlMs: number;
}): Promise<boolean> {
  const link = linkTo('/verify-email', input.token);

  return sendMail({
    to: input.to,
    subject: `Confirm your ${clientEnv.appName} email address`,
    text: [
      `Hi${input.name ? ` ${input.name}` : ''},`,
      '',
      `Confirm this address to finish setting up your ${clientEnv.appName} account:`,
      '',
      link,
      '',
      `The link works once and expires in ${humanTtl(input.ttlMs)}.`,
      '',
      'If you did not create an account, you can ignore this message.',
    ].join('\n'),
  });
}

/**
 * Tells a user their password changed.
 *
 * Sent after the fact rather than as a confirmation step: if the change was not
 * theirs, this is the notice that lets them react while the reset flow is still
 * available to them.
 */
export function sendPasswordChangedEmail(input: {
  to: string;
  name: string | null;
}): Promise<boolean> {
  return sendMail({
    to: input.to,
    subject: `Your ${clientEnv.appName} password was changed`,
    text: [
      `Hi${input.name ? ` ${input.name}` : ''},`,
      '',
      `The password on your ${clientEnv.appName} account was just changed, and`,
      'every signed-in device has been signed out.',
      '',
      'If that was you, there is nothing to do.',
      '',
      'If it was not, reset your password immediately:',
      new URL('/forgot-password', clientEnv.appUrl).toString(),
    ].join('\n'),
  });
}
