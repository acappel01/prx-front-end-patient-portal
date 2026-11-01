import { NextResponse } from 'next/server';

import { accountError } from '@/lib/accountErrors';
import { adminFetch, revokeAfterResponse } from '@/lib/adminApi';
import { guardRequest, readBody } from '@/lib/requestGuard';
import { sessionToken, startSession } from '@/lib/session';

/**
 * Use a create-account link: set a password, and the admin creates the account
 * for the address the link was emailed to, connected to that order's record.
 *
 * The admin mints a session in the same response, exchanged here for the
 * httpOnly cookie exactly as sign-in does; the browser never sees the token.
 * No email is sent upstream — the admin takes it from the link, and a field
 * here would only suggest otherwise.
 */

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const refused = guardRequest(request);
  if (refused) return refused;

  const read = await readBody(request);
  if (read.response) return read.response;
  const payload = read.body;
  const token = typeof payload?.token === 'string' ? payload.token : '';
  const password = typeof payload?.password === 'string' ? payload.password : '';

  if (!token || !password) {
    return NextResponse.json({ message: 'Choose a password.' }, { status: 422 });
  }

  // A session already in this browser is replaced below, and revoked upstream.
  const previousToken = await sessionToken();

  const result = await adminFetch('/patient/auth/create-account', {
    method: 'POST',
    token: '',
    body: { token, password },
  });

  if (result.status === 0) {
    return NextResponse.json({ message: 'We could not reach the service. Please try again in a moment.' }, { status: 503 });
  }

  if (result.ok && result.data?.token) {
    revokeAfterResponse(previousToken);
    await startSession(result.data.token);

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  }

  return accountError(result, '/patient/auth/create-account');
}
