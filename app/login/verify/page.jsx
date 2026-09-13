import { redirect } from 'next/navigation';

import AccountShell from '@/components/account/AccountShell';
import TwoFactorCodeForm from '@/components/ui/TwoFactorCodeForm';
import { challengeToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * The code step of a two-step sign-in. Reachable only while a challenge cookie
 * exists (set by `/api/session` after a correct password); otherwise back to
 * the password. The challenge value never reaches this page's markup.
 */
export default async function VerifyPage() {
  if (!(await challengeToken())) {
    redirect('/login');
  }

  return (
    <AccountShell>
      <TwoFactorCodeForm />
    </AccountShell>
  );
}
