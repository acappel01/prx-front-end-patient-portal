import { NextResponse } from 'next/server';

import { accountError } from '@/lib/accountErrors';
import { adminFetch } from '@/lib/adminApi';
import { endSession } from '@/lib/session';

/**
 * Use a password-reset link.
 *
 * Deliberately does NOT start a session. The admin signs every session out and
 * issues none: the link proves the mailbox, and it must not stand in for a
 * second factor once sign-in has one. The page sends the person to sign in.
 */

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const payload = await request.json().catch(() => null);
  const token = typeof payload?.token === 'string' ? payload.token : '';
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!token || !password) {
    return NextResponse.json({ message: 'Choose a new password.' }, { status: 422 });
  }

  let result;
  try {
    result = await adminFetch('/patient/auth/password/reset', {
      method: 'POST',
      token: '',
      body: { token, password },
    });
  } catch {
    return NextResponse.json({ message: 'We could not reach the service. Please try again in a moment.' }, { status: 503 });
  }

  if (result.ok) {
    // The admin has revoked every session, so any cookie this browser holds is
    // dead. Clear it: the next page should be a clean sign-in, not a signed-in
    // shell that fails with "Session expired".
    await endSession();

    return NextResponse.json({ data: { changed: true }, message: result.message });
  }

  return accountError(result, '/patient/auth/password/reset');
}
