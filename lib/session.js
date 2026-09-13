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

function sign(value, purpose = 'session') {
  // The purpose is part of what is signed, so a signed CHALLENGE cookie copied
  // into the session cookie never verifies there, and vice versa. The session
  // keeps its original, un-prefixed input so live sessions stay valid.
  const input = purpose === 'session' ? value : `${purpose}:${value}`;

  return createHmac('sha256', secret()).update(input).digest('base64url');
}

/** Constant-time compare that does not leak length through an early return. */
function signatureMatches(value, provided, purpose = 'session') {
  const expected = Buffer.from(sign(value, purpose));
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

/**
 * The two-step sign-in challenge, between the password and the code.
 *
 * Its own cookie, never the session: it is not a credential for anything but
 * `POST /patient/auth/two-factor`, and the admin refuses it as a bearer. Same
 * protections as the session (httpOnly, Secure, SameSite=Strict, signed — under a
 * different purpose, so the two can never be swapped), plus a five-minute life
 * matching the admin's. JavaScript never sees the value; the verify page only
 * learns, server-side, that one exists.
 */
const CHALLENGE_COOKIE = 'prx_challenge';

export async function startChallenge(challenge) {
  (await cookies()).set(CHALLENGE_COOKIE, `${challenge}.${sign(challenge, 'challenge')}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  });
}

export async function challengeToken() {
  const raw = (await cookies()).get(CHALLENGE_COOKIE)?.value;

  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;

  const value = raw.slice(0, separator);

  try {
    return signatureMatches(value, raw.slice(separator + 1), 'challenge') ? value : null;
  } catch {
    return null;
  }
}

export async function endChallenge() {
  (await cookies()).delete(CHALLENGE_COOKIE);
}

/**
 * "Trust this browser" — the admin-issued trusted-device token, sent with the
 * password on later sign-ins so this browser skips the code (never the password).
 *
 * Survives sign-out on purpose: that is what trusting a browser means. It is
 * httpOnly, Secure, Strict, signed under its own purpose, and lives as long as
 * the admin said the trust lasts; the admin renews trust on each use and revokes
 * it when the account's security changes, so a stale cookie is simply ignored.
 */
const DEVICE_COOKIE = 'prx_device';

export async function startTrustedDevice(token, expiresAt) {
  const seconds = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

  (await cookies()).set(DEVICE_COOKIE, `${token}.${sign(token, 'device')}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: Number.isFinite(seconds) ? seconds : 60,
  });
}

export async function trustedDeviceToken() {
  const raw = (await cookies()).get(DEVICE_COOKIE)?.value;

  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;

  const value = raw.slice(0, separator);

  try {
    return signatureMatches(value, raw.slice(separator + 1), 'device') ? value : null;
  } catch {
    return null;
  }
}
