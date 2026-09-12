import { redirect } from 'next/navigation';

import LoginForm from '@/components/ui/LoginForm';
import { adminFetch, deploymentConfig } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // A signed cookie is not a live session. The signature proves WE minted it;
  // only the admin knows whether the token inside was since revoked (a claim
  // revokes other sessions). Redirecting on the signature alone was an
  // inescapable loop: `/login` → `/` → admin 401 → "Sign in again" → `/login`,
  // with the form never rendered. Ask the admin, and bounce only a session it
  // still accepts. A dead cookie is simply overwritten by the next sign-in, so
  // it needs no clearing here.
  //
  // This is the escape hatch, so it must always render: an unreachable admin
  // (adminFetch throws on a network failure) shows the form, not a 500.
  //
  // Do NOT copy this check into the (portal) layout. `/patient/auth/me` sits
  // behind the admin's `auth` limiter (10/min per IP), and one call per page
  // view would lock a patient out of signing in after ten taps.
  if (await sessionToken()) {
    let live = false;
    try {
      live = (await adminFetch('/patient/auth/me')).ok;
    } catch {
      // Treat as not live; the form renders.
    }

    if (live) redirect('/');
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
