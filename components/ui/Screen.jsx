import { redirect } from 'next/navigation';

import { adminFetch } from '@/lib/adminApi';

/**
 * Shared shape for a read-only screen: fetch, then render one of three states.
 *
 * It exists so that "session expired" and "could not load" are handled once
 * rather than copy-pasted into five screens where one of them will eventually
 * be missed and throw a 500 onto a clinical page.
 */
export default async function Screen({ title, path, empty, emptyAction, action, children }) {
  const { ok, status, data, code } = await adminFetch(path);

  // The install requires two-step verification and this account lacks it.
  if (status === 403 && code === 'two_factor_setup_required') {
    redirect('/record/security?required=1');
  }

  if (status === 401) {
    return (
      <>
        <h1>{title}</h1>
        <p className="prx-muted">
          Your session expired. <a href="/login">Sign in again</a>.
        </p>
      </>
    );
  }

  if (!ok) {
    return (
      <>
        <h1>{title}</h1>
        <p className="prx-muted">We can&rsquo;t load this right now. Please try again in a moment.</p>
      </>
    );
  }

  const rows = Array.isArray(data) ? data : (data?.items ?? []);

  return (
    <>
      <h1>{title}</h1>
      {/* A screen with rows on it still needs its way forward. `emptyAction`
          only ever renders once, on the one visit where there is nothing to
          do — after which the invitation disappears for good. */}
      {action && rows.length > 0 ? (
        <p className="prx-screen__action">
          <a className="prx-task__cta" href={action.href}>
            {action.label}
          </a>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="prx-stack__clear">
          <p>{empty}</p>
          {/* Where a way forward exists, offer it. An empty screen is the most
              attention this view will ever get; spending it on "nothing here"
              is the failure mode the design rules call out by name. */}
          {emptyAction ? (
            <p className="prx-stack__clear__action">
              <a className="prx-task__cta" href={emptyAction.href}>
                {emptyAction.label}
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        children(rows, data)
      )}
    </>
  );
}
