import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Health — one mental model: my numbers over time.
 *
 * The empty state ASKS for a reading rather than reporting its absence. A tile
 * that says "no data yet" spends prime space advertising that the product is
 * empty and never asks for the thing that would fill it.
 *
 * Charts land here next, rendered from API-supplied series behind a swappable
 * component boundary — the charting library is a deployment choice, never a
 * hardcoded dependency of the skeleton.
 */
export default function HealthPage() {
  return (
    <Screen
      title="Your progress"
      path="/patient/vitals"
      empty="Add your first reading and your progress starts building from today."
      emptyAction={{ href: '/health/log', label: 'Log a reading' }}
    >
      {(rows) => (
        <ul className="prx-rows">
          {rows.map((vital) => (
            <li className="prx-row" key={vital.id}>
              {/* `weight`, not `weight_lbs`. The provider's API takes
                  `weight_lbs` on the way IN and returns `weight` on the way
                  out; reading the request's name here renders a blank row. */}
              <span>
                {vital.weight != null ? `${vital.weight} lbs` : 'Reading'}
                {vital.systolic_bp != null && vital.diastolic_bp != null
                  ? ` · ${vital.systolic_bp}/${vital.diastolic_bp}`
                  : ''}
              </span>
              <span className="prx-row__meta">{vital.created_at}</span>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
