import TaskCard from '@/components/stack/TaskCard';

/**
 * The action stack. The portal RENDERS a ranked list; it never ranks one.
 *
 * `tasks` arrives already sorted by the admin (tier ascending, then soonest
 * deadline). Re-sorting here — even "just to be safe" — would be the drift the
 * server-ranking rule exists to prevent, and would make the policy unauditable.
 *
 * The only structural rule enforced locally is presentational: routine items
 * collapse into one row, because a routine item carrying weight is a routine
 * item competing with a live one.
 */
export default function ActionStack({ tasks = [] }) {
  if (tasks.length === 0) {
    // Empty state is SUCCESS, not absence. It is never a grid of "no data yet"
    // tiles advertising that the product is empty.
    return (
      <section className="prx-stack">
        <p className="prx-stack__clear">You&rsquo;re up to date. Nothing needs you right now.</p>
      </section>
    );
  }

  const primary = tasks.filter((task) => task.tier < 3);
  const routine = tasks.filter((task) => task.tier >= 3);

  return (
    <section className="prx-stack" aria-label="Tasks that need you">
      <p className="prx-stack__label">
        <span>Needs you</span>
        <span>{tasks.length} open</span>
      </p>

      {primary.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}

      {routine.length > 0 ? (
        <details className="prx-task prx-task--routine">
          <summary>
            {routine.length} routine {routine.length === 1 ? 'item' : 'items'}
            {' · '}
            {routine.map((task) => task.title).join(', ')}
          </summary>

          <ul className="prx-rows">
            {routine.map((task) => (
              <li className="prx-row" key={task.id}>
                <span>{task.title}</span>
                {task.cta_url ? <a href={task.cta_url}>{task.cta_label}</a> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
