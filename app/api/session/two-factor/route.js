import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
import { landingFor } from '@/lib/landing';
import { challengeToken, endChallenge, startSession } from '@/lib/session';

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
  const challenge = await challengeToken();

  if (!challenge) {
    return NextResponse.json({ message: 'Your sign-in timed out. Sign in again.', restart: true }, { status: 410 });
  }

  const payload = await request.json().catch(() => null);
  const code = typeof payload?.code === 'string' ? payload.code : null;
  const recoveryCode = typeof payload?.recovery_code === 'string' ? payload.recovery_code : null;

  if (!code && !recoveryCode) {
    return NextResponse.json({ message: 'Enter the code.' }, { status: 422 });
  }

  const result = await adminFetch('/patient/auth/two-factor', {
    method: 'POST',
    token: '',
    body: { challenge, ...(recoveryCode ? { recovery_code: recoveryCode } : { code }) },
  }).catch(() => null);

  if (!result) {
    return NextResponse.json({ message: 'We couldn’t reach the server. Try again in a moment.' }, { status: 503 });
  }

  if (result.ok && result.data?.token) {
    await endChallenge();
    await startSession(result.data.token);

    return NextResponse.json({ data: { ok: true, next: landingFor(result.data.patient) } });
  }

  if (result.status === 429) {
    await endChallenge();

    return NextResponse.json({ message: result.message ?? 'Too many attempts. Wait a few minutes, then sign in again.', restart: true }, { status: 429 });
  }

  return NextResponse.json(
    { message: result.errors?.code?.[0] ?? result.message ?? 'That code didn’t work.' },
    { status: result.status === 422 ? 422 : 400 }
  );
}

/** "Back to sign in": forget the challenge. */
export async function DELETE() {
  await endChallenge();

  return NextResponse.json({ data: { ok: true } });
}
