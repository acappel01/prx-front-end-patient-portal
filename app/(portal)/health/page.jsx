import LocalTime from '@/components/ui/LocalTime';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Health — one mental model: my numbers over time.
 *
 * The empty state ASKS for a reading rather than reporting its absence. A tile
 * that says "no data yet" spends prime space advertising that the product is
 * empty and never asks for the thing that would fill it.
 *
 * This list is also where the log form sends anyone whose save could not be
 * confirmed (a write can commit before an error — P0-7 did it on every call), so every row
 * has to be legible enough to answer "is the reading I just took in here?".
 * That is why it renders every measurement rather than only weight, and why
 * the timestamp is localised rather than left as a UTC ISO string.
 *
 * Charts land here next, rendered from API-supplied series behind a swappable
 * component boundary — the charting library is a deployment choice, never a
 * hardcoded dependency of the skeleton.
 */

/**
 * Field names are the RESPONSE names. The provider's vitals endpoint takes
 * `weight_lbs` / `blood_pressure_systolic` in and returns `weight` /
 * `systolic_bp` out; reading the request's names here renders a blank row,
 * which is how this shipped once already.
 */
function measurements(vital) {
  const parts = [];

  if (vital.weight != null) parts.push(`${vital.weight} lbs`);

  // Blood pressure is one measurement written as two numbers. A lone half is
  // not a reading, so it is not rendered as one.
  if (vital.systolic_bp != null && vital.diastolic_bp != null) {
    parts.push(`${vital.systolic_bp}/${vital.diastolic_bp}`);
  }

  if (vital.heart_rate != null) parts.push(`${vital.heart_rate} bpm`);
  if (vital.blood_glucose != null) parts.push(`${vital.blood_glucose} mg/dL`);

  return parts;
}

export default function HealthPage() {
  return (
    <Screen
      title="Your progress"
      path="/patient/vitals"
      empty="Add your first reading and your progress starts building from today."
      emptyAction={{ href: '/health/log', label: 'Log a reading' }}
      action={{ href: '/health/log', label: 'Log a reading' }}
    >
      {(rows) => (
        <ul className="prx-rows">
          {rows.map((vital) => {
            const parts = measurements(vital);

            return (
              <li className="prx-row" key={vital.id}>
                <span>
                  {/* A row with no recognised number still renders, and says
                      so. Dropping it would hide a reading the patient knows
                      they took — on the one screen they came to check. */}
                  {parts.length > 0 ? parts.join(' · ') : 'Reading recorded'}
                </span>
                <span className="prx-row__meta">
                  <LocalTime value={vital.created_at} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
