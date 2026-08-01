/**
 * The published support address.
 *
 * Client components and legal pages need this, so it cannot come from
 * `serverEnv()`. It is a constant rather than a public env var because Google
 * Play requires the contact on the privacy policy to be stable and reachable:
 * a deployment that forgot to set the variable would publish a policy with a
 * blank contact, which is a listing rejection.
 *
 * Keep in step with `CONTACT_INBOX`, which is where the contact form delivers.
 */
export const SUPPORT_EMAIL = 'support@hexaconverter.app';
