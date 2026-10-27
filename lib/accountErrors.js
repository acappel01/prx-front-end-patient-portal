import 'server-only';

import { NextResponse } from 'next/server';

/**
 * What the create-account and reset routes say when the admin refuses.
 *
 * The admin gives one sentence for every token failure — unknown, used, expired,
 * sent elsewhere — on purpose, and that sentence is passed through rather than
 * interpreted. A 429 is a rate limit and is said as one, never as a bad link.
 */
export function accountError(result, route) {
  if (result.status === 429) {
    return NextResponse.json({ message: 'Too many attempts. Wait a minute and try again.' }, { status: 429 });
  }

  if (result.status === 422) {
    return NextResponse.json(
      {
        message:
          result.errors?.password?.[0] ??
          result.errors?.token?.[0] ??
          'This link is invalid or has expired. Request a new one from the sign-in page.',
        field: result.errors?.password ? 'password' : 'token',
      },
      { status: 422 }
    );
  }

  // The page shows a fixed sentence, so say here what the admin answered.
  // Status and request id only: never the token or the password.
  console.error(`[account] admin answered HTTP ${result.status} on ${route}${result.requestId ? ` (request ${result.requestId})` : ''}`);

  return NextResponse.json({ message: 'Something went wrong. Please try again in a moment.' }, { status: 503 });
}
