import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
import { landingFor } from '@/lib/landing';
import { endChallenge, endSession, startChallenge, startSession } from '@/lib/session';

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
  const payload = await request.json().catch(() => null);

  if (!payload?.email || !payload?.password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 422 });
  }

  const result = await adminFetch('/patient/auth/login', {
    method: 'POST',
    // Explicitly no session token: this call mints one.
    token: '',
    body: { email: payload.email, password: payload.password },
  });

  // Two-step verification on: no session yet. The challenge goes into its own
  // short-lived cookie and the browser is told only to ask for the code.
  if (result.ok && result.data?.two_factor_required && result.data?.challenge) {
    await endSession();
    await startChallenge(result.data.challenge);

    return NextResponse.json({ data: { two_factor: true } });
  }

  if (!result.ok || !result.data?.token) {
    // One message for a bad password and for an unknown address. Distinguishing
    // them turns this endpoint into an account-existence oracle, which for a
    // clinical service leaks that a named person is a patient.
    return NextResponse.json({ message: 'Those details did not match.' }, { status: 401 });
  }

  await startSession(result.data.token);

  return NextResponse.json({ data: { ok: true, next: landingFor(result.data.patient) } });
}

/**
 * Keep-alive and liveness for SessionTimeout. Using the session is what keeps
 * it alive admin-side, so this simply uses it — through the patient group's
 * general limiter, never the sign-in limiter behind `/patient/auth/me`.
 */
export async function GET() {
  const result = await adminFetch('/patient/session').catch(() => null);

  if (!result) {
    return NextResponse.json({ message: 'Unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  // Deadlines only; the token never leaves this server.
  return NextResponse.json(
    result.ok ? { data: result.data } : { message: result.message ?? 'Session ended.' },
    { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function DELETE() {
  // Best-effort revocation upstream; the local cookie is cleared either way.
  // A sign-out that leaves the cookie because the network hiccuped is the
  // worst possible outcome on a shared device.
  await adminFetch('/patient/auth/logout', { method: 'POST' }).catch(() => null);
  await endSession();

  return NextResponse.json({ data: { ok: true } });
}
