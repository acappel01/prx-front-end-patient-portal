import 'server-only';

import { redirect } from 'next/navigation';

import { TWO_FACTOR_SETUP_PATH, needsTwoFactorSetup } from '@/lib/landing';

/**
 * The one decision every server screen makes about an admin answer before it
 * renders anything: the install's `required` two-step policy sends the session
 * to set it up (a redirect, so this does not return), and a 401 means the
 * session has ended. Screens then render the 401 their own way (a "Sign in
 * again" line, or a redirect to /login) and handle everything else
 * themselves. `Screen` and the pages that cannot use it all call this, so the
 * rule cannot drift between them again.
 *
 * @param {import('@/lib/models').AdminResult} result adminFetch()'s answer
 * @returns {boolean} true when the session has expired (401)
 */
export function guard(result) {
  if (needsTwoFactorSetup(result)) redirect(TWO_FACTOR_SETUP_PATH);

  return result?.status === 401;
}
