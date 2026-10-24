import { adminFetch } from '@/lib/adminApi';

/**
 * A line at the top of Care when the provider added items that wait on the
 * patient. Home already ranks this; Care repeats it because Care is where a
 * patient goes to look at their treatment. Quiet on failure.
 */
export default async function ApprovalsNotice() {
  const result = await adminFetch('/patient/approvals').catch(() => null);
  const count = result?.ok ? (result.data?.items ?? []).length : 0;

  if (count === 0) return null;

  return (
    <p className="prx-card prx-approval__notice">
      <strong>{count === 1 ? 'Your provider added an item.' : `Your provider added ${count} items.`}</strong> Nothing is charged until you
      approve.{' '}
      <a className="prx-task__cta" href="/care/approvals">
        Review and decide
      </a>
    </p>
  );
}
