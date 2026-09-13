import { cookies } from 'next/headers';

import TwoFactorPromptCard from '@/components/account/TwoFactorPromptCard';
import { adminFetch } from '@/lib/adminApi';

/**
 * "Protect your account" on Home — the "strongly offered" half of the optional
 * two-step policy.
 *
 * Shown only when the install offers two-step verification, does not require it
 * (then the admin confines the session instead), and this account lacks it.
 * "Not now" hides it for 30 days in a plain preference cookie — it holds no
 * identity, only the fact of a dismissal. Any failure renders nothing: this is
 * an invitation, never something that may break Home.
 */
export const DISMISS_COOKIE = 'prx_2fa_prompt';

export default async function TwoFactorPrompt() {
  if ((await cookies()).get(DISMISS_COOKIE)?.value === 'dismissed') return null;

  const result = await adminFetch('/patient/two-factor').catch(() => null);
  const status = result?.ok ? result.data : null;

  if (!status || status.enabled || !status.offered || status.policy !== 'optional') return null;

  return <TwoFactorPromptCard cookieName={DISMISS_COOKIE} />;
}
