import { NextResponse } from 'next/server';

import { adminFetch, revokeAfterResponse } from '@/lib/adminApi';
import { landingFor } from '@/lib/landing';
import { guardRequest, readBody } from '@/lib/requestGuard';
import { endSession, sessionToken, startChallenge, startSession, startTrustedDevice, trustedDeviceToken } from '@/lib/session';
import { signInRefusal } from '@/lib/signInRefusal';

/**
 * Sign in and out.
 *
 * The credential is exchanged for an admin-issued patient token server-side;
 * the browser receives only a Set-Cookie it cannot read. The clinical provider
 * is never contacted from here and the patient never sees it — one credential
 * boundary, one audit point.
 */

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const refused = guardRequest(request);
  if (refused) return refused;

  const read = await readBody(request);
  if (read.response) return read.response;
  const payload = read.body;

  if (!payload?.email || !payload?.password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 422 });
  }

  // Read once: sent with the password, and re-set below if the admin renews it.
  const deviceToken = await trustedDeviceToken();

  // Read before anything replaces it: a sign-in over an existing session
  // revokes that session's token upstream once this one is in place.
  const previousToken = await sessionToken();

  const result = await adminFetch('/patient/auth/login', {
    method: 'POST',
    // Explicitly no session token: this call mints one.
    token: '',
    body: {
      email: payload.email,
      password: payload.password,
      // A browser trusted after an earlier code; the admin honours it only
      // after checking the password, and only for this account.
      ...(deviceToken ? { trusted_device_token: deviceToken } : {}),
    },
  });

  // Two-step verification on: no session yet. The challenge goes into its own
  // short-lived cookie and the browser is told only to ask for the code. The
  // old session ends here, so it is revoked here too.
  if (result.ok && result.data?.two_factor_required && result.data?.challenge) {
    revokeAfterResponse(previousToken);
    await endSession();
    await startChallenge(result.data.challenge);

    return NextResponse.json({ data: { two_factor: true } });
  }

  if (!result.ok || !result.data?.token) {
    // Only a credential refusal says "did not match"; an outage says so, with
    // its Reference (lib/signInRefusal.js). A failed sign-in leaves any
    // existing session alone.
    const refusal = signInRefusal(result);
    if (refusal.log) console.error(refusal.log);

    return NextResponse.json(
      { message: refusal.message, ...(refusal.requestId ? { request_id: refusal.requestId } : {}) },
      { status: refusal.status }
    );
  }

  revokeAfterResponse(previousToken);
  await startSession(result.data.token);

  // A trusted browser skipped the code and the admin renewed its trust: extend
  // the cookie to the renewed expiry, or it would lapse at the original one
  // however often this browser signs in.
  if (result.data.trusted_device?.expires_at && deviceToken) {
    await startTrustedDevice(deviceToken, result.data.trusted_device.expires_at);
  }

  return NextResponse.json({ data: { ok: true, next: landingFor(result.data.patient) } });
}

/**
 * Keep-alive and liveness for SessionTimeout. Using the session is what keeps
 * it alive admin-side, so this simply uses it — through the patient group's
 * general limiter, never the sign-in limiter.
 */
export async function GET() {
  const result = await adminFetch('/patient/session');

  if (result.status === 0) {
    return NextResponse.json({ message: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  // Deadlines only; the token never leaves this server. `now` is this
  // server's clock, so the tab can count down against the admin's deadlines
  // without trusting the device's own clock to agree with them.
  return NextResponse.json(
    result.ok ? { data: { ...result.data, now: new Date().toISOString() } } : { message: result.message ?? 'Session ended.' },
    { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function DELETE(request) {
  // Sign-out is a write too: a sibling-site script must not end a session.
  const refused = guardRequest(request, { kind: 'none' });
  if (refused) return refused;

  // Best-effort revocation upstream; the local cookie is cleared either way.
  // A sign-out that leaves the cookie because the network hiccuped is the
  // worst possible outcome on a shared device.
  await adminFetch('/patient/auth/logout', { method: 'POST' });
  await endSession();

  return NextResponse.json({ data: { ok: true } });
}
