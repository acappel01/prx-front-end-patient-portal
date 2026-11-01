import Link from 'next/link';
import { redirect } from 'next/navigation';

import GoalForm from '@/components/health/GoalForm';
import Reference from '@/components/ui/Reference';
import { adminFetch } from '@/lib/adminApi';
import { guard } from '@/lib/screenGuards';

export const dynamic = 'force-dynamic';

/**
 * Set (or change) the weight goal — the destination of Home's "Set a goal".
 *
 * The goal lives on the provider's chart (`/me/patient/vitals/goals`), so the
 * care team sees the same number and Home's progress is measured against it.
 */
export default async function GoalPage() {
  const result = await adminFetch('/patient/vitals/goals');
  const { ok, status, data, code, requestId } = result;

  if (guard(result)) redirect('/login');

  if (status === 409 && code === 'no_linked_chart') {
    return (
      <>
        <h1>Your weight goal</h1>
        <p className="prx-muted">Connect your medical record first, and your goal will sit alongside your readings.</p>
        <p>
          <a className="prx-task__cta" href="/connect">
            Connect your record
          </a>
        </p>
      </>
    );
  }

  if (!ok) {
    return (
      <>
        <h1>Your weight goal</h1>
        <p className="prx-muted">We can&rsquo;t load this right now. Please try again in a moment.</p>
        {status >= 500 ? <Reference id={requestId} /> : null}
      </>
    );
  }

  return (
    <>
      <p className="prx-back">
        <Link href="/">← Home</Link>
      </p>
      <h1>Your weight goal</h1>
      <GoalForm current={data} />
    </>
  );
}
