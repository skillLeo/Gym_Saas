/**
 * Turns any axios/API error into a single clean, human-readable sentence.
 * Never surfaces raw stack traces, query strings, or technical error objects to the user.
 */

/**
 * Statuses that mean "the server could not take this request right now", as
 * opposed to "the server rejected what you sent".
 *
 * This matters on the current hosting. When the account hits its resource
 * ceiling LiteSpeed answers with its own 503 HTML page, which carries no JSON
 * `errors`, `error` or `message` field — so every caller fell through to its
 * fallback text. Those fallbacks are written for rejection ("Could not save
 * your profile"), which tells the user their input was refused and invites them
 * to change it, when in fact nothing reached the application and the right
 * action is simply to try again. A member lost an onboarding save to exactly
 * this and had no way to tell it apart from a validation failure.
 */
const BUSY_STATUSES = [502, 503, 504];

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const response = (err as any)?.response;
  const data = response?.data;
  const status = response?.status;

  // Field-level validation always wins: it is the most specific and actionable
  // thing we can say, and it never accompanies a 5xx.
  if (data?.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors).flat().filter(Boolean) as string[];
    if (messages.length > 0) return messages.join(' ');
  }

  // Checked before the generic message extraction below, because a transient
  // outage is better described by "try again" than by whatever the
  // infrastructure happened to say — Laravel's maintenance mode, for instance,
  // returns a bare "Service Unavailable", which reads like a dead end.
  if (typeof status === 'number' && BUSY_STATUSES.includes(status)) {
    return 'The server is busy, please try again in a moment.';
  }

  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;

  // Network-level failures (no response at all) shouldn't leak axios internals
  if ((err as any)?.message === 'Network Error') return 'Could not reach the server. Check your connection and try again.';

  return fallback;
}
