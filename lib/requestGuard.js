/**
 * The one gate in front of every route handler that changes something.
 *
 * WHY. The session cookie is SameSite=Strict, but "site" is the registrable
 * domain: `portal.example.com`, the storefront on `example.com` and the admin
 * on `admin.example.com` are all the SAME site, so a script on any of them can
 * send this portal a credentialed POST. The storefront runs operator-pasted
 * tags by design. Without this check one bad tag could write to a signed-in
 * patient's clinical record or sign the browser into another account.
 *
 * The rule, in order:
 *
 * 1. `PORTAL_URL` must be configured. It is the expected `Origin`, so an unset
 *    value fails closed (500, logged once) rather than silently trusting all.
 * 2. `Sec-Fetch-Site: same-origin` is accepted. Every current browser sends it
 *    and a page script cannot forge it.
 * 3. Otherwise `Origin` must equal PORTAL_URL's origin, or the answer is 403
 *    `{code: 'cross_origin'}`. No Origin at all is refused too.
 * 4. A declared Content-Length over the route's cap is 413 before any byte is
 *    read; `readBody()` enforces the same cap while reading, for a body sent
 *    without a length.
 * 5. A JSON route refuses any other Content-Type with 415, so a CORS "simple"
 *    `text/plain` or form post is never parsed as JSON.
 *
 * Call `guardRequest()` FIRST in every non-GET handler under app/api, and
 * read the body only through `readBody()`, never `request.json()`.
 *
 * No Next imports and no `server-only`: this holds no secret, and staying
 * plain keeps it testable with `node --test`.
 */

const KB = 1024;

/** Body caps. The intake upload passes its own, larger, multipart cap. */
export const LIMITS = Object.freeze({
  json: 16 * KB,
  proxy: 64 * KB,
});

let reportedMisconfiguration = false;

/**
 * This portal's public origin, from PORTAL_URL. Throws a clear error when it
 * is unset or not an http(s) URL; there is no fallback. `value` is for the
 * startup check (lib/env.js), which validates an env object.
 */
export function portalOrigin(value = process.env.PORTAL_URL) {

  if (!value) {
    throw new Error('PORTAL_URL is not configured. Set it to this portal\'s public origin (e.g. https://portal.example.com); every form and button that changes something is refused without it.');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('PORTAL_URL is not a valid URL. Set it to this portal\'s public origin, e.g. https://portal.example.com.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('PORTAL_URL must be an http(s) origin, e.g. https://portal.example.com.');
  }

  return url.origin;
}

function refuse(status, message, code) {
  return Response.json({ message, code }, { status });
}

function mediaType(request) {
  return (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
}

function tooLarge(message) {
  return refuse(413, message ?? 'That request is too large.', 'too_large');
}

function unsupported() {
  return refuse(415, 'That request is not in a format this page sends.', 'unsupported_media_type');
}

/**
 * @typedef {object} GuardOptions
 * @property {'json' | 'multipart' | 'none'} [kind]
 * @property {number} [maxBytes]
 * @property {string} [tooLargeMessage] the route's own 413 sentence
 */

/**
 * Header-only checks; reads nothing. Returns a Response to send back, or null
 * when the request may go on.
 *
 * `kind`: 'json' (default), 'multipart', or 'none' for a handler that takes
 * no body (sign-out), which is still origin-checked.
 */
/** @param {Request} request @param {GuardOptions} [options] */
export function guardRequest(request, { kind = 'json', maxBytes = LIMITS.json, tooLargeMessage } = {}) {
  let expected;
  try {
    expected = portalOrigin();
  } catch (error) {
    if (!reportedMisconfiguration) {
      reportedMisconfiguration = true;
      console.error(`[requestGuard] ${error.message}`);
    }

    return refuse(500, 'This portal is not set up to accept changes yet. Please try again later.', 'misconfigured');
  }

  if (request.headers.get('sec-fetch-site') !== 'same-origin' && request.headers.get('origin') !== expected) {
    return refuse(403, 'This request did not come from the portal.', 'cross_origin');
  }

  if (kind === 'none') return null;

  const declared = request.headers.get('content-length');
  const length = declared === null ? null : Number(declared);

  if (length !== null && (!Number.isFinite(length) || length > maxBytes)) return tooLarge(tooLargeMessage);

  const type = mediaType(request);

  if (kind === 'multipart') return type === 'multipart/form-data' ? null : unsupported();

  // A bodiless POST (no type, no length) is fine; a body must say it is JSON.
  if (type === '' ? length !== null && length > 0 : type !== 'application/json') return unsupported();

  return null;
}

async function readCapped(request, limit) {
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    total += value.byteLength;

    if (total > limit) {
      await reader.cancel();

      return null;
    }

    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return out;
}

/**
 * Read the body under the same cap `guardRequest()` checked, counting bytes as
 * they arrive (a chunked body declares no length). Returns `{ response }` to
 * send back, or `{ body }`: parsed JSON (null when empty or not JSON, as
 * `request.json().catch(() => null)` gave before), or the raw bytes for
 * 'multipart'.
 */
/** @param {Request} request @param {GuardOptions} [options] */
export async function readBody(request, { kind = 'json', maxBytes = LIMITS.json, tooLargeMessage } = {}) {
  const raw = await readCapped(request, maxBytes);

  if (raw === null) return { response: tooLarge(tooLargeMessage) };

  if (kind === 'multipart') return { body: raw };

  if (raw.byteLength === 0) return { body: null };

  if (mediaType(request) !== 'application/json') return { response: unsupported() };

  try {
    return { body: JSON.parse(new TextDecoder().decode(raw)) };
  } catch {
    return { body: null };
  }
}
