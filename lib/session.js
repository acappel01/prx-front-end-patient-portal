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
const CHALLENGE_COOKIE = 'prx_challenge';
const DEVICE_COOKIE = 'prx_device';

/**
 * Every signed cookie here: httpOnly (never readable from JavaScript), Secure,
 * SameSite=Strict, whole site.
 */
const COOKIE_OPTIONS = Object.freeze({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' });

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

/**
 * @typedef {'session' | 'challenge' | 'device'} Purpose
 * What a signed value is for. The purpose is part of what is signed, so a
 * signed CHALLENGE copied into the session cookie never verifies there, and
 * vice versa.
 */

/** @param {string} value @param {Purpose} purpose */
function sign(value, purpose) {
  // The session keeps its original, un-prefixed input so live sessions stay valid.
  const input = purpose === 'session' ? value : `${purpose}:${value}`;

  return createHmac('sha256', secret()).update(input).digest('base64url');
}

/** Constant-time compare that does not leak length through an early return. */
function signatureMatches(value, provided, purpose) {
  const expected = Buffer.from(sign(value, purpose));
  const actual = Buffer.from(provided);

  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

/**
 * The value of a signed cookie, or null when it is missing, malformed, or
 * signed for another purpose. Never throws on a bad cookie: a bad cookie is an
 * anonymous visitor.
 *
 * @param {string} name the cookie
 * @param {Purpose} purpose what it must have been signed for
 * @returns {Promise<string | null>}
 */
export async function readSigned(name, purpose) {
  const raw = (await cookies()).get(name)?.value;

  if (!raw) return null;

  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;

  const value = raw.slice(0, separator);

  try {
    return signatureMatches(value, raw.slice(separator + 1), purpose) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Set a signed cookie, `<value>.<signature>`, with the shared protections.
 * `maxAge` in seconds; leave it out for a browser-session cookie.
 *
 * @param {string} name
 * @param {string} value
 * @param {Purpose} purpose
 * @param {number} [maxAge]
 */
export async function writeSigned(name, value, purpose, maxAge) {
  (await cookies()).set(name, `${value}.${sign(value, purpose)}`, {
    ...COOKIE_OPTIONS,
    ...(maxAge === undefined ? {} : { maxAge }),
  });
}

/** Read the patient token from the session, or null when there is no valid one. */
export async function sessionToken() {
  return readSigned(COOKIE, 'session');
}

/**
 * Mint the session cookie for a token the admin just issued. Session cookie —
 * no maxAge. The admin ends the session (idle limit and absolute cap,
 * Settings → Patient portal) and a dead token is a 401 that every screen
 * already handles; a second clock here would only disagree.
 */
export async function startSession(token) {
  await writeSigned(COOKIE, token, 'session');
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * The two-step sign-in challenge, between the password and the code.
 *
 * Its own cookie, never the session: it is not a credential for anything but
 * `POST /patient/auth/two-factor`, and the admin refuses it as a bearer. Same
 * protections as the session, signed under a different purpose, so the two
 * can never be swapped, plus a five-minute life matching the admin's.
 * JavaScript never sees the value; the verify page only learns, server-side,
 * that one exists.
 */
export async function startChallenge(challenge) {
  await writeSigned(CHALLENGE_COOKIE, challenge, 'challenge', 300);
}

export async function challengeToken() {
  return readSigned(CHALLENGE_COOKIE, 'challenge');
}

export async function endChallenge() {
  (await cookies()).delete(CHALLENGE_COOKIE);
}

/**
 * "Trust this browser" — the admin-issued trusted-device token, sent with the
 * password on later sign-ins so this browser skips the code (never the password).
 *
 * Survives sign-out on purpose: that is what trusting a browser means. Signed
 * under its own purpose, and lives as long as the admin said the trust lasts;
 * the admin renews trust on each use and revokes it when the account's
 * security changes, so a stale cookie is simply ignored.
 */
export async function startTrustedDevice(token, expiresAt) {
  const seconds = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

  await writeSigned(DEVICE_COOKIE, token, 'device', Number.isFinite(seconds) ? seconds : 60);
}

export async function trustedDeviceToken() {
  return readSigned(DEVICE_COOKIE, 'device');
}
