/**
 * Turns any axios/API error into a single clean, human-readable sentence.
 * Never surfaces raw stack traces, query strings, or technical error objects to the user.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as any)?.response?.data;

  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat().filter(Boolean) as string[];
    if (messages.length > 0) return messages.join(' ');
  }

  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;

  // Network-level failures (no response at all) shouldn't leak axios internals
  if ((err as any)?.message === 'Network Error') return 'Could not reach the server. Check your connection and try again.';

  return fallback;
}
