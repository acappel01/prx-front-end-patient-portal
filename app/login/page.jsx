import { redirect } from 'next/navigation';

import AccountShell from '@/components/account/AccountShell';
import LoginForm from '@/components/ui/LoginForm';
import { adminFetch } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }) {
  // `1`: the idle limit ran out. `limit`: the session reached its absolute cap.
  const expired = (await searchParams)?.expired;

  // A signed cookie is not a live session. The signature proves WE minted it;
  // only the admin knows whether the token inside was since revoked (a claim
  // revokes other sessions). Redirecting on the signature alone was an
  // inescapable loop: `/login` → `/` → admin 401 → "Sign in again" → `/login`,
  // with the form never rendered. Ask the admin, and bounce only a session it
  // still accepts. A dead cookie is simply overwritten by the next sign-in, so
  // it needs no clearing here.
  //
  // This is the escape hatch, so it must always render: an unreachable admin
  // (adminFetch answers `ok: false, status: 0`, never throws) shows the form.
  //
  // Do NOT copy this check into the (portal) layout. A call per page view is
  // an extra admin round-trip on every navigation and spends the patient's
  // per-account API budget (120/min) for nothing the screens don't already
  // learn from their own 401s. (It used to sit behind the sign-in limiter too;
  // since 2026-09-13 it does not.)
  if (await sessionToken()) {
    if ((await adminFetch('/patient/auth/me')).ok) redirect('/');
  }

  return (
    <AccountShell>
      {expired === '1' ? (
        <p className="prx-notice" role="status">
          You were signed out after a period of inactivity, to keep your information safe. Sign in again to continue.
        </p>
      ) : expired === 'limit' ? (
        <p className="prx-notice" role="status">
          Your session reached its time limit, so you were signed out to keep your information safe. Sign in again to continue.
        </p>
      ) : null}
      <LoginForm />
      <p>
        <a href="/forgot">Forgot your password?</a>
      </p>
      <p>
        New here? <a href="/register">Create your account</a>
      </p>
    </AccountShell>
  );
}
