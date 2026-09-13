import ActionStack from '@/components/stack/ActionStack';
import ProgressSummary from '@/components/stack/ProgressSummary';
import { redirect } from 'next/navigation';

import TwoFactorPrompt from '@/components/account/TwoFactorPrompt';
import Reference from '@/components/ui/Reference';
import { adminFetch } from '@/lib/adminApi';

/**
 * Home.
 *
 * One call, not six. `GET /patient/home` is a SCREEN-SHAPED endpoint: the admin
 * fans out to the clinical provider in parallel and returns this screen's
 * payload already composed and already ranked.
 *
 * That shape is the performance model. The obvious alternative — cache the
 * clinical reads in Redis — is storing PHI, so it is not available to us; the
 * lever we do have is fan-out reduction. Six sequential provider round-trips
 * from a mobile connection is the thing to avoid, and one composed call is how.
 *
 * The portal opens with what you owe it, not with everything it holds.
 */

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { ok, status, data, code, requestId } = await adminFetch('/patient/home');

  if (status === 403 && code === 'two_factor_setup_required') {
    redirect('/record/security?required=1');
  }

  if (status === 401) {
    // A token minted before an ability existed will lack it, and an expired
    // one looks the same. Both are re-authentication, never a failure screen.
    return (
      <>
        <h1>Session expired</h1>
        <p className="prx-muted">
          <a href="/login">Sign in again</a> to see your care.
        </p>
      </>
    );
  }

  if (!ok) {
    // Degrade to a real empty state rather than a stack trace. A clinical
    // screen that crashes is worse than one that says it cannot load.
    return (
      <>
        <h1>We can&rsquo;t load your care right now</h1>
        <p className="prx-muted">Please try again in a moment.</p>
        {status >= 500 ? <Reference id={requestId} /> : null}
      </>
    );
  }

  // `linked: false` is a valid account with zero clinical visibility — the
  // normal state between signing up and finishing intake. Rendering the usual
  // empty stack here would tell someone with a completed consultation that
  // they have nothing to do, which is both wrong and the exact moment the
  // product loses them. It is the one thing standing between this account and
  // everything, so it gets the screen rather than a row on it.
  if (data?.linked === false) {
    return (
      <>
        <h1>{data?.greeting ?? 'Your care'}</h1>
        <TwoFactorPrompt />
        <div className="prx-task prx-task--blocking">
          <h2 className="prx-task__title">Connect your medical record</h2>
          <p className="prx-task__body">
            Your consultation created a record with your provider. Connect it once and your care,
            prescriptions and results appear here.
          </p>
          <a className="prx-task__cta" href="/connect">
            Connect it now
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{data?.greeting ?? 'Your care'}</h1>
      <TwoFactorPrompt />
      <ActionStack tasks={data?.tasks ?? []} />
      <ProgressSummary summary={data?.summary} />
    </>
  );
}
