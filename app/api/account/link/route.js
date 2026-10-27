import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';

/**
 * "Email me a link" — create an account, or reset a password. No session.
 *
 * Both intents reach the same admin decision (an address with an account gets a
 * reset link; one with an order and no account gets a create-account link), so
 * the intent only picks which of two identical admin routes to call. The admin
 * answers the same 202 whatever exists under the address, and this passes that
 * sentence through untouched: nothing here may turn a 202 into a hint.
 *
 * NOT through the portal proxy, which requires a session. The body is rebuilt
 * from the one field the admin reads, never forwarded wholesale.
 */

export const dynamic = 'force-dynamic';

const ROUTES = {
  register: '/patient/auth/register',
  forgot: '/patient/auth/password/forgot',
};

export async function POST(request) {
  const payload = await request.json().catch(() => null);
  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  // Own keys only: `constructor` must not resolve to a function and become a path.
  const route = Object.hasOwn(ROUTES, payload?.intent ?? '') ? ROUTES[payload.intent] : null;

  if (!email || !route) {
    return NextResponse.json({ message: 'Enter your email address.' }, { status: 422 });
  }

  let result;
  try {
    result = await adminFetch(route, { method: 'POST', token: '', body: { email } });
  } catch (error) {
    // The route and reason only: never the address.
    console.error(`[account/link] admin unreachable on ${route}: ${error?.message ?? error}`);
    return NextResponse.json({ message: 'We could not reach the service. Please try again in a moment.' }, { status: 503 });
  }

  if (result.status === 202) {
    return NextResponse.json({ data: { sent: true }, message: result.message }, { status: 202 });
  }

  // Each of these describes the request or the installation, never the address,
  // so each may be told as it is. A 429 in particular is NOT "did not match".
  if (result.status === 429) {
    return NextResponse.json(
      { message: 'You have asked for several links recently. Check your inbox, or try again later.' },
      { status: 429 }
    );
  }

  if (result.status === 422) {
    return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 422 });
  }

  // The admin's 503 names the installation ("cannot send email right now") and
  // is written for a visitor. Anything else unexpected — a 404 from an admin
  // older than this portal, a 500 — gets a fixed sentence, never upstream text.
  if (result.status === 503 && result.message) {
    return NextResponse.json({ message: result.message }, { status: 503 });
  }

  // Logged so the operator can see what the admin answered (the page shows
  // only the fixed sentence). Status and request id, never the address.
  console.error(`[account/link] admin answered HTTP ${result.status} on ${route}${result.requestId ? ` (request ${result.requestId})` : ''}`);

  return NextResponse.json({ message: 'We could not send the email right now. Please try again later.' }, { status: 503 });
}
