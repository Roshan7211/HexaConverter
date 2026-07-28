import type { ApiError } from '@/types/api';

/** Browser-side calls for the account and recovery flows. */

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const parsed = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (parsed as ApiError).error
        : 'The request failed.';
    throw new Error(message);
  }

  return parsed as T;
}

export interface MessageResponse {
  message: string;
}

/** Always resolves the same way for any address — see the route handler. */
export function requestPasswordReset(email: string): Promise<MessageResponse> {
  return post<MessageResponse>('/api/auth/forgot-password', { email });
}

export function resetPassword(
  token: string,
  password: string,
): Promise<MessageResponse & { email: string }> {
  return post('/api/auth/reset-password', { token, password });
}

export function verifyEmail(
  token: string,
): Promise<MessageResponse & { email: string }> {
  return post('/api/auth/verify-email', { token });
}

export function resendVerification(email: string): Promise<MessageResponse> {
  return post<MessageResponse>('/api/auth/resend-verification', { email });
}

/** Revokes every session, including this one. */
export async function signOutEverywhere(): Promise<MessageResponse> {
  const response = await fetch('/api/account/sessions', { method: 'DELETE' });
  const parsed = (await response.json()) as MessageResponse | ApiError;

  if (!response.ok) {
    const message = 'error' in parsed ? parsed.error : 'The request failed.';
    throw new Error(message);
  }

  return parsed as MessageResponse;
}
