import 'server-only';

import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The portal session.
 *
 * The session holds the admin-issued patient token. It lives in an httpOnly,
 * SameSite=Strict, Secure cookie and is never readable from JavaScript — the
 * browser's job is to send it, not to see it.
 *
 * WHY THE COOKIE IS SIGNED. It carries a bearer token, so a tampered value is
 * simply rejected upstream and costs nothing. The signature is not protecting
 * the token; it is protecting us from *treating an attacker-chosen string as a
 * session*. Without it, anyone can set `prx_session` on this origin (a
 * subdomain, an XSS anywhere on a sibling host) and every request we make
 * upstream carries their value. Signing means a session we did not mint is not
 * a session at all, and the failure is a clean logout rather than a confused
 * upstream call.
 *
 * NOTE: this deliberately stores the TOKEN and nothing else. No name, no chart
 * id, no clinical value. Anything the UI needs about the patient is fetched
 * per request from the admin, because a cookie is a copy and a copy of PHI in
 * a browser is PHI at rest that nothing will ever revoke.
 */

const COOKIE = 'prx_session';

function secret() {
  const value = process.env.SESSION_SECRET;

  if (!value) {
    // Fail closed. An unset secret must never silently degrade to an unsigned
    // cookie — that is the exact shape of a control that looks present and is
    // absent in production.
    throw new Error('SESSION_SECRET is not configured. Refusing to issue unsigned sessions.');
  }

  return value;
}

function sign(value) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

/** Constant-time compare that does not leak length through an early return. */
function signatureMatches(value, provided) {
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(provided);

  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

/**
 * Read the patient token from the session, or null when there is no valid one.
 * Never throws on a malformed cookie — a bad cookie is an anonymous visitor.
 */
export async function sessionToken() {
  const raw = (await cookies()).get(COOKIE)?.value;

  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;

  const token = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);

  try {
    return signatureMatches(token, signature) ? token : null;
  } catch {
    return null;
  }
}

/** Mint the session cookie for a token the admin just issued. */
export async function startSession(token) {
  (await cookies()).set(COOKIE, `${token}.${sign(token)}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    // Session cookie — no maxAge. The admin ends the session (idle limit and
    // absolute cap, Settings → Patient portal) and a dead token is a 401 that
    // every screen already handles; a second clock here would only disagree.
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
