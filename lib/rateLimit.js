/**
 * What a 429 means to a patient, said one way everywhere.
 *
 * The admin's limiters send `Retry-After` with every 429. The portal proxy used
 * to rebuild the response without it, so a form showed its generic "couldn't
 * save" copy and the patient retried straight into the limiter. Now the proxy
 * passes the wait on (header and `retry_after` in the body) and replaces the
 * message with `tooManyMessage()`, so every form that shows the answer's
 * message says how long to wait without knowing anything about rate limits.
 *
 * The sign-in, account-link and two-step routes keep their own 429 sentences:
 * those limiters are per network address and the copy says so.
 *
 * Pure, no Next imports and no `server-only`: the proxy route and the browser's
 * `portalCall()` both use it, and `node --test` can import it.
 */

/** Never tell a patient to wait longer than this, whatever the header says. */
const MAX_WAIT_SECONDS = 60 * 60;

/**
 * Seconds from a `Retry-After` value — delta-seconds or an HTTP date — or null
 * when it is missing or unreadable. Rounded up, at least 1, at most an hour.
 */
export function retryAfterSeconds(value, now = Date.now()) {
  if (value === null || value === undefined || value === '') return null;

  const text = String(value).trim();
  let seconds;

  if (/^\d+$/.test(text)) {
    seconds = Number(text);
  } else {
    const at = Date.parse(text);
    if (!Number.isFinite(at)) return null;
    seconds = Math.ceil((at - now) / 1000);
  }

  if (!Number.isFinite(seconds)) return null;

  return Math.min(MAX_WAIT_SECONDS, Math.max(1, Math.ceil(seconds)));
}

/** The one sentence for a rate-limited request. */
export function tooManyMessage(seconds) {
  if (!seconds) return 'Too many tries. Wait a minute, then try again.';
  if (seconds < 60) return `Too many tries. Wait ${seconds} second${seconds === 1 ? '' : 's'}, then try again.`;

  const minutes = Math.ceil(seconds / 60);

  return `Too many tries. Wait ${minutes} minute${minutes === 1 ? '' : 's'}, then try again.`;
}

/**
 * The body and headers a route handler answers a 429 with, from adminFetch()'s
 * `retryAfter`. Spread into `NextResponse.json(body, { status: 429, headers })`.
 */
export function rateLimitReply(retryAfter) {
  return {
    body: { message: tooManyMessage(retryAfter), ...(retryAfter ? { retry_after: retryAfter } : {}) },
    headers: retryAfter ? { 'Retry-After': String(retryAfter) } : {},
  };
}
