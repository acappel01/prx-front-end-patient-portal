import { redirect } from 'next/navigation';

import Reference from '@/components/ui/Reference';
import { adminFetch } from '@/lib/adminApi';

/**
 * Shared shape for a read-only screen: fetch, then render one of three states.
 *
 * It exists so that "session expired" and "could not load" are handled once
 * rather than copy-pasted into five screens where one of them will eventually
 * be missed and throw a 500 onto a clinical page.
 */
export default async function Screen({ title, path, empty, emptyAction, action, rowsOf, children }) {
  const { ok, status, data, code, requestId } = await adminFetch(path);

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

  // A signed-in account with no medical record linked yet is the normal state
  // between signing up and connecting, not a fault. Keyed on the admin's code,
  // not the status: the clinical provider's own conflicts are 409s too.
  if (status === 409 && code === 'no_linked_chart') {
    return (
      <>
        <h1>{title}</h1>
        <p className="prx-muted">Connect your medical record, and this will fill in from your care.</p>
        <p>
          <a className="prx-task__cta" href="/connect">
            Connect your record
          </a>
        </p>
      </>
    );
  }

  // The install switched this area off: the care team keeps it instead.
  if (status === 403 && code === 'module_off') {
    return (
      <>
        <h1>{title}</h1>
        <p className="prx-muted">
          Your care team keeps this up to date. <a href="/talk">Message them</a> if something has changed.
        </p>
      </>
    );
  }

  if (!ok) {
    return (
      <>
        <h1>{title}</h1>
        <p className="prx-muted">We can&rsquo;t load this right now. Please try again in a moment.</p>
        {status >= 500 ? <Reference id={requestId} /> : null}
      </>
    );
  }

  // `rowsOf` picks the list out of a screen-shaped payload; the default reads a
  // bare list or `items`.
  const rows = rowsOf ? (rowsOf(data) ?? []) : Array.isArray(data) ? data : (data?.items ?? []);

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
