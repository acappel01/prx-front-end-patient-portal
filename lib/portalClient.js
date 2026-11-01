import { TWO_FACTOR_SETUP_PATH, needsTwoFactorSetup } from '@/lib/landing';
import { retryAfterSeconds } from '@/lib/rateLimit';

/**
 * Every browser call this app makes, for client components: the same-origin
 * proxy (`portalCall`, `app/api/portal`) and the portal's own routes
 * (`apiCall`: sign-in, account, the intake upload). One place decides what a
 * 401 and the two-step `required` policy mean, how a body is sent and how a
 * response is unwrapped, so no form re-implements it — eight did, and their
 * copies had drifted (some handled the 403 or a 429, others did not).
 *
 * Never throws: a network failure comes back as `{ ok: false, status: 0 }`,
 * which each caller must treat as "we do not know what happened" — for a
 * charge or a reading that is the uncertain case, not a failure to retry.
 *
 * Signed-in calls (the default):
 * - a 401 sends the patient to sign in (`onUnauthenticated: 'sign-in'`), or
 *   re-renders the page (`'reload'`: the claim page, which signs in in place),
 *   or is just returned (`'none'`: a form that shows its own expired state);
 * - a `403 {code: two_factor_setup_required}` sends the session to set up
 *   two-step verification, as the server screens do (lib/screenGuards.js).
 *
 * Anonymous calls (`signedIn: false`: sign-in, the two-step code, the account
 * links, sign-out) navigate nowhere: a 401 there is "those details did not
 * match", which the form shows.
 *
 * Plain module, no React: `node --test` imports it with a stubbed `fetch` and
 * `window`.
 */

/**
 * @typedef {object} CallOptions
 * @property {'GET' | 'POST' | 'DELETE'} [method]
 * @property {unknown} [body] JSON-encoded, or sent as is when it is FormData
 *   (the browser sets the multipart boundary)
 * @property {Record<string, string>} [headers] extra request headers; the
 *   proxy passes on only `Idempotency-Key` (lib/idempotencyHeader.js)
 * @property {ReferrerPolicy} [referrerPolicy] `'no-referrer'` on a page whose
 *   URL carries a token
 * @property {boolean} [signedIn] false for the anonymous routes (no navigation)
 * @property {'sign-in' | 'reload' | 'none'} [onUnauthenticated] what a 401 does
 */

/** @type {import('@/lib/models').CallResult} */
const UNREACHABLE = Object.freeze({
  ok: false,
  status: 0,
  data: null,
  meta: null,
  message: null,
  errors: null,
  code: null,
  requestId: null,
  retryAfter: null,
  payload: null,
});

/**
 * Call one of this app's own routes from the browser.
 *
 * @param {string} url a same-origin path, e.g. `/api/session`
 * @param {CallOptions} [options]
 * @returns {Promise<import('@/lib/models').CallResult>}
 */
export async function apiCall(url, { method = 'GET', body, headers = {}, referrerPolicy, signedIn = true, onUnauthenticated = 'sign-in' } = {}) {
  const form = typeof FormData !== 'undefined' && body instanceof FormData;

  const response = await fetch(url, {
    method,
    cache: 'no-store',
    headers: { ...(body === undefined || form ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
    ...(referrerPolicy ? { referrerPolicy } : {}),
  }).catch(() => null);

  if (!response) return { ...UNREACHABLE };

  if (signedIn && response.status === 401 && onUnauthenticated !== 'none') {
    if (onUnauthenticated === 'reload') window.location.reload();
    else window.location.assign('/login');

    return { ...UNREACHABLE, status: 401 };
  }

  const payload = await response.json().catch(() => null);

  const result = {
    ok: response.ok,
    status: response.status,
    data: payload?.data ?? null,
    meta: payload?.meta ?? null,
    message: payload?.message ?? null,
    errors: payload?.errors ?? null,
    code: payload?.code ?? null,
    requestId: payload?.request_id ?? null,
    // On a 429 the proxy passes the limiter's wait on, and `message` is already
    // the shared "Too many tries, wait N seconds" sentence (lib/rateLimit.js), so
    // a form that shows `message` needs nothing else.
    retryAfter: response.status === 429 ? (retryAfterSeconds(response.headers.get('retry-after')) ?? payload?.retry_after ?? null) : null,
    // The whole body, for the rare field outside the envelope (`restart` on the
    // two-step route, `field` on the account routes).
    payload,
  };

  if (signedIn && needsTwoFactorSetup(result)) window.location.assign(TWO_FACTOR_SETUP_PATH);

  return result;
}

/**
 * Call the admin through the same-origin proxy. `path` is the admin path
 * (`/patient/vitals`), with any query string; the proxy's allowlist decides
 * whether it is reachable.
 *
 * @param {string} path
 * @param {CallOptions} [options]
 */
export function portalCall(path, options) {
  return apiCall(`/api/portal${path}`, options);
}

/**
 * The first message per field of a 422, keyed by field.
 *
 * @param {Record<string, string[] | string> | null | undefined} errors
 * @returns {Record<string, string>}
 */
export function fieldErrors(errors) {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([name, messages]) => [name, Array.isArray(messages) ? messages[0] : String(messages)])
  );
}
