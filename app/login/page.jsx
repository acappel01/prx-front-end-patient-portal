import { redirect } from 'next/navigation';

import LoginForm from '@/components/ui/LoginForm';
import { adminFetch, deploymentConfig } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // A signed cookie is not a live session. The signature proves WE minted it;
  // only the admin knows whether the token inside was since revoked (a claim
  // revokes other sessions) or expired. Redirecting on the signature alone was
  // an inescapable loop: `/login` → `/` → admin 401 → "Sign in again" →
  // `/login`, with the form never rendered. Ask the admin, and bounce only a
  // session it still accepts. A dead cookie is simply overwritten by the next
  // sign-in, so it needs no clearing here.
  if (await sessionToken()) {
    const me = await adminFetch('/patient/auth/me');

    if (me.ok) redirect('/');
  }

  const config = await deploymentConfig();

  return (
    <div className="prx-app">
      <main className="prx-main">
        {/* The deployment's name, never a compiled-in brand. */}
        <h1>{config?.brand?.name ?? 'Patient portal'}</h1>
        <LoginForm />
      </main>
    </div>
  );
}
