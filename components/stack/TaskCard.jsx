import Countdown from '@/components/stack/Countdown';

/**
 * One ranked task.
 *
 * The tier decides the treatment and nothing else does — this component never
 * inspects what a task IS. Which tier a task belongs to is clinical and
 * commercial policy, computed by the admin, because two deployments may
 * legitimately disagree about what is urgent and that difference is
 * configuration rather than a fork.
 */

const TIER_CLASS = {
  0: 'prx-task--live',
  1: 'prx-task--blocking',
  2: 'prx-task--timeboxed',
  3: 'prx-task--routine',
};

export default function TaskCard({ task }) {
  const tierClass = TIER_CLASS[task.tier] ?? 'prx-task--routine';

  return (
    <article className={`prx-task ${tierClass}`}>
      {task.chip_label ? (
        <p className="prx-task__chip">
          {task.tier === 0 ? <span className="prx-pulse" aria-hidden="true" /> : null}
          {/* The deadline is the chip, never body copy — "expires in 3 days"
              is actionable where a timestamp makes the patient do arithmetic. */}
          {task.deadline ? (
            <Countdown deadline={task.deadline} fallback={task.chip_label} />
          ) : (
            task.chip_label
          )}
        </p>
      ) : null}

      <h2 className="prx-task__title">{task.title}</h2>

      {/* A blocking task always says WHY. "Finish your intake" is a chore;
          "your provider can't review this until you do" is a reason. */}
      {task.body ? <p className="prx-task__body">{task.body}</p> : null}

      {typeof task.progress_pct === 'number' ? (
        <div
          className="prx-task__meter"
          role="progressbar"
          aria-valuenow={task.progress_pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Completion"
        >
          <span style={{ width: `${Math.min(100, Math.max(0, task.progress_pct))}%` }} />
        </div>
      ) : null}

      {task.cta_url ? (
        <a className="prx-task__cta" href={task.cta_url}>
          {task.cta_label}
        </a>
      ) : null}
    </article>
  );
}
