import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
import { landingFor } from '@/lib/landing';
import { guardRequest, readBody } from '@/lib/requestGuard';
import { challengeToken, endChallenge, startSession, startTrustedDevice } from '@/lib/session';
import { signInRefusal } from '@/lib/signInRefusal';

/**
 * The second step of a two-step sign-in: the code in, the session cookie out.
 *
 * The challenge comes from its httpOnly cookie, never from the browser's body,
 * so a page script can neither read nor supply one. Refusals keep the admin's
 * one sentence; a dead challenge (expired, used up) clears the cookie so the
 * patient is sent back to the password rather than typing codes into nothing.
 */

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const refused = guardRequest(request);
  if (refused) return refused;

  const challenge = await challengeToken();

  if (!challenge) {
    return NextResponse.json({ message: 'Your sign-in timed out. Sign in again.', restart: true }, { status: 410 });
  }

  const read = await readBody(request);
  if (read.response) return read.response;
  const payload = read.body;
  const code = typeof payload?.code === 'string' ? payload.code : null;
  const recoveryCode = typeof payload?.recovery_code === 'string' ? payload.recovery_code : null;

  if (!code && !recoveryCode) {
    return NextResponse.json({ message: 'Enter the code.' }, { status: 422 });
  }

  const result = await adminFetch('/patient/auth/two-factor', {
    method: 'POST',
    token: '',
    body: {
      challenge,
      ...(recoveryCode ? { recovery_code: recoveryCode } : { code }),
      ...(payload?.trust_device === true ? { trust_device: true } : {}),
    },
  });

  if (result.ok && result.data?.token) {
    await endChallenge();
    await startSession(result.data.token);

    if (result.data.trusted_device?.token) {
      await startTrustedDevice(result.data.trusted_device.token, result.data.trusted_device.expires_at);
    }

    return NextResponse.json({ data: { ok: true, next: landingFor(result.data.patient) } });
  }

  if (result.status === 429) {
    await endChallenge();

    return NextResponse.json({ message: result.message ?? 'Too many attempts. Wait a few minutes, then sign in again.', restart: true }, { status: 429 });
  }

  // Every refusal of the code is a 422. Anything else is the admin or the
  // network failing, never a wrong code (lib/signInRefusal.js); the challenge
  // cookie is kept so the patient can try the same code again.
  if (result.status === 422) {
    return NextResponse.json({ message: result.errors?.code?.[0] ?? result.message ?? 'That code didn’t work.' }, { status: 422 });
  }

  const refusal = signInRefusal(result, '/patient/auth/two-factor');
  if (refusal.log) console.error(refusal.log);

  return NextResponse.json(
    { message: refusal.message, ...(refusal.requestId ? { request_id: refusal.requestId } : {}) },
    { status: refusal.status }
  );
}

/** "Back to sign in": forget the challenge. */
export async function DELETE(request) {
  const refused = guardRequest(request, { kind: 'none' });
  if (refused) return refused;

  await endChallenge();

  return NextResponse.json({ data: { ok: true } });
}
