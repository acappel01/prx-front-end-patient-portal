/**
 * The non-task half of Home.
 *
 * It exists partly because a one-task stack left most of a 390px screen empty,
 * and dead space on the first screen is a wasted answer to "is it working?" —
 * the second half of the question this portal is built to answer.
 *
 * Every figure comes from `/patient/home`'s `summary`, already filtered. Two
 * deliberate omissions:
 *
 * - `upcoming_encounters` is NOT shown. Upstream counts statuses
 *   `['scheduled','pending']`, and `pending` is not a real encounter status —
 *   the values are `pending_intake` / `pending_provider_review` — so the number
 *   silently under-counts. A wrong number on a clinical screen is worse than no
 *   number, and the action stack already surfaces anything imminent.
 * - `progress_percent` is not rendered as a bare number; it only means anything
 *   next to the goal it is progress toward.
 */
export default function ProgressSummary({ summary }) {
  if (!summary) return null;

  const weight = summary.current_weight;
  const goal = summary.weight_goal;
  const prescriptions = summary.active_prescriptions;

  return (
    <section className="prx-summary" aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="prx-stack__label">
        <span>Your progress</span>
      </h2>

      <div className="prx-card">
        {weight != null ? (
          <div className="prx-metric">
            <span className="prx-metric__value">{weight}</span>
            <span className="prx-metric__unit">lbs</span>
            {goal != null ? (
              <span className="prx-metric__meta">Goal {goal} lbs</span>
            ) : (
              // Ask for the thing that would make this useful, rather than
              // reporting that it is missing.
              <a className="prx-metric__meta" href="/health/goal">
                Set a goal
              </a>
            )}
          </div>
        ) : (
          <p className="prx-muted" style={{ margin: 0 }}>
            No readings yet.{' '}
            <a href="/health/log">Log your first one</a> and your progress starts from today.
          </p>
        )}
      </div>

      {prescriptions > 0 ? (
        <a className="prx-card prx-row" href="/care" style={{ textDecoration: 'none' }}>
          <span>Active treatment</span>
          <span className="prx-row__meta">
            {prescriptions} {prescriptions === 1 ? 'prescription' : 'prescriptions'}
          </span>
        </a>
      ) : null}
    </section>
  );
}
