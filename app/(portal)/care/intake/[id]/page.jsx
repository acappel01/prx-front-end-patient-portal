import { adminFetch } from '@/lib/adminApi';

export const dynamic = 'force-dynamic';

/**
 * The destination of the tier-1 "documents needed" card.
 *
 * It exists because that card is the most important thing in the product and
 * it previously pointed at a 404 — but read the honesty note below before
 * extending it.
 *
 * WHY THIS SCREEN CANNOT YET FINISH THE JOB. Outstanding identity items come in
 * two kinds. File items (a photo of an ID) are satisfiable: the provider has an
 * endpoint that accepts an upload. Text items (licence number, state of issue)
 * are NOT — the only API that writes intake answers persists them under a
 * different key than the provider's own completeness gate reads, so submitting
 * one returns 200, writes an audit entry, and leaves the encounter held exactly
 * as it was. It is on the change request.
 *
 * So this screen separates the two and says which is which. A screen that
 * listed all three under one "upload" button would send someone into a loop
 * they cannot get out of, and they would blame themselves for it. Being
 * straight about the wall is worth more than a control that quietly fails.
 */
export default async function IntakePage({ params }) {
  const { id } = await params;

  const { ok, status, data } = await adminFetch('/patient/home');

  if (status === 401) {
    return (
      <>
        <h1>Session expired</h1>
        <p className="prx-muted">
          <a href="/login">Sign in again</a> to continue.
        </p>
      </>
    );
  }

  const task = ok
    ? (data?.tasks ?? []).find((candidate) => candidate.id === `encounter:${id}:blocking`)
    : null;

  if (!task) {
    // Either it is finished or it was never outstanding. Both are good news,
    // and neither is an error to apologise for.
    return (
      <>
        <h1>Nothing outstanding</h1>
        <p className="prx-stack__clear">
          There is nothing left to send for this visit.
        </p>
        <p>
          <a href="/">Back to your care</a>
        </p>
      </>
    );
  }

  const actionable = task.outstanding_actionable ?? [];
  const blocked = task.outstanding_blocked ?? [];

  return (
    <>
      <h1>{task.title}</h1>
      <p className="prx-task__body">{task.body}</p>

      {typeof task.progress_pct === 'number' ? (
        <div
          className="prx-task__meter"
          role="progressbar"
          aria-valuenow={task.progress_pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Intake completion"
        >
          <span style={{ width: `${task.progress_pct}%` }} />
        </div>
      ) : null}

      {actionable.length > 0 ? (
        <section className="prx-card" aria-labelledby="can-send">
          <h2 id="can-send">You can send these now</h2>
          <ul className="prx-rows">
            {actionable.map((slug) => (
              <li className="prx-row" key={slug}>
                {/* The label comes from the admin, never from a map compiled in
                    here — `drivers_license_or_identification_state_of_issue` is
                    not something to show a person. Until that lands the raw slug
                    is at least honest rather than invented. */}
                <span>{task.labels?.[slug] ?? slug}</span>
              </li>
            ))}
          </ul>
          <p className="prx-muted">Uploading is not switched on yet — it is the next thing being built.</p>
        </section>
      ) : null}

      {blocked.length > 0 ? (
        <section className="prx-card" aria-labelledby="ask-provider">
          <h2 id="ask-provider">Your care team needs to add these for you</h2>
          <ul className="prx-rows">
            {blocked.map((slug) => (
              <li className="prx-row" key={slug}>
                <span>{task.labels?.[slug] ?? slug}</span>
              </li>
            ))}
          </ul>
          <p className="prx-muted">
            These can&rsquo;t be submitted from here yet. Message your care team and they can add
            them for you.
          </p>
          <a className="prx-task__cta" href="/talk">
            Message your care team
          </a>
        </section>
      ) : null}
    </>
  );
}
