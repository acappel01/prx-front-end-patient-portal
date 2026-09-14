import TrendChart from '@/components/charts/TrendChart';
import LocalTime from '@/components/ui/LocalTime';
import Screen from '@/components/ui/Screen';
import { deploymentConfig } from '@/lib/adminApi';
import { labsEnabled } from '@/lib/labHistory.mjs';

export const dynamic = 'force-dynamic';

/**
 * Health — one mental model: my numbers over time.
 *
 * One call: the admin's `/patient/health/series` composes the chart series, the
 * weight goal and the recent readings, so drawing the screen is never four
 * sequential fetches from a phone.
 *
 * The empty state ASKS for a reading rather than reporting its absence. A tile
 * that says "no data yet" spends prime space advertising that the product is
 * empty and never asks for the thing that would fill it.
 *
 * The readings list is also where the log form sends anyone whose save could
 * not be confirmed (a write can commit before an error — P0-7 did it on every
 * call), so every row has to be legible enough to answer "is the reading I just
 * took in here?". That is why it renders every measurement rather than only
 * weight, and why the timestamp is localised rather than left as a UTC ISO
 * string.
 *
 * The period is in the URL (`?period=all`), so the server renders it and a
 * shared link keeps it. A year is the default; "All time" is there for a patient
 * who has been in care longer — the history lives with the provider and is never
 * lost by choosing the shorter view.
 */

const PERIODS = [
  { key: '1year', label: 'Past year' },
  { key: 'all', label: 'All time' },
];

function number(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function weightSummary(points, goal) {
  const first = points[0].value;
  const latest = points.at(-1).value;
  const change = Math.round((latest - first) * 10) / 10;

  const trend = points.length < 2
    ? 'Log another reading and your trend starts here.'
    : change === 0
      ? 'No change across these readings.'
      : `${change < 0 ? 'Down' : 'Up'} ${number(Math.abs(change))} lbs across these readings.`;

  if (goal == null) return trend;

  // Where the latest reading sits against the goal — and nothing more. The
  // direction of travel cannot be inferred: the first reading in the window is
  // not where the patient started, and guessing it once congratulated a patient
  // 10 lbs above their goal (live probe, 2026-09-13). "Reached" only within half
  // a pound, where above and below stop meaning anything.
  const gap = Math.round((latest - goal) * 10) / 10;

  if (Math.abs(gap) < 0.5) return `${trend} You're at your goal of ${number(goal)} lbs.`;

  return `${trend} ${number(Math.abs(gap))} lbs ${gap > 0 ? 'above' : 'below'} your goal of ${number(goal)} lbs.`;
}

function latestSummary(points, noun) {
  return points.length < 2
    ? `Your latest ${noun}. Log another and your trend starts here.`
    : `Your latest ${noun}, from ${points.length} readings.`;
}

function Charts({ data }) {
  const series = data?.series ?? {};
  const goal = data?.goal?.weight ?? null;
  const weight = series.weight ?? [];
  const pressure = series.blood_pressure ?? [];
  const heart = series.heart_rate ?? [];
  const glucose = series.blood_glucose ?? [];

  return (
    <>
      {weight.length > 0 ? (
        <TrendChart
          title="Weight"
          headline={`${number(weight.at(-1).value)} lbs`}
          lines={[{ label: 'Weight', points: weight }]}
          target={goal != null ? { value: goal, label: `Goal ${number(goal)} lbs` } : null}
          summary={weightSummary(weight, goal)}
        />
      ) : data?.period === '1year' && (data?.items ?? []).some((vital) => vital.weight != null) ? (
        // Weights exist, just none this year: point at them rather than asking
        // for a "first" reading the list below plainly shows they have taken.
        <p className="prx-stack__clear">
          No weight readings in the past year. <a href="/health?period=all">See all time</a>.
        </p>
      ) : (
        <div className="prx-stack__clear">
          <p>Log your weight and your progress line starts from today.</p>
        </div>
      )}

      {weight.length > 0 && goal == null ? (
        <p className="prx-screen__action">
          <a href="/health/goal">Set a goal</a> and it will be drawn on your chart.
        </p>
      ) : null}

      {pressure.length > 0 ? (
        <TrendChart
          title="Blood pressure"
          headline={`${pressure.at(-1).systolic}/${pressure.at(-1).diastolic}`}
          lines={[
            { label: 'Systolic', points: pressure.map((p) => ({ at: p.at, value: p.systolic })) },
            { label: 'Diastolic', tone: 'muted', points: pressure.map((p) => ({ at: p.at, value: p.diastolic })) },
          ]}
          summary={latestSummary(pressure, 'blood pressure')}
        />
      ) : null}

      {heart.length > 0 ? (
        <TrendChart
          title="Heart rate"
          headline={`${heart.at(-1).value} bpm`}
          lines={[{ label: 'Heart rate', points: heart }]}
          summary={latestSummary(heart, 'heart rate')}
        />
      ) : null}

      {glucose.length > 0 ? (
        <TrendChart
          title="Blood glucose"
          headline={`${glucose.at(-1).value} mg/dL`}
          lines={[{ label: 'Blood glucose', points: glucose }]}
          summary={latestSummary(glucose, 'blood glucose')}
        />
      ) : null}

      {data?.truncated ? (
        <p className="prx-muted">Charts show your most recent {data.readings_considered} readings.</p>
      ) : null}
    </>
  );
}

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

export default async function HealthPage({ searchParams }) {
  const requested = (await searchParams)?.period;
  const config = await deploymentConfig();
  const period = PERIODS.some((p) => p.key === requested) ? requested : '1year';

  return (
    <>
    {labsEnabled(config) ? <p className="prx-screen__action"><a href="/health/labs">View lab orders</a></p> : null}
    <Screen
      title="Your progress"
      path={`/patient/health/series?period=${period}`}
      empty="Add your first reading and your progress starts building from today."
      emptyAction={{ href: '/health/log', label: 'Log a reading' }}
      action={{ href: '/health/log', label: 'Log a reading' }}
    >
      {(rows, data) => (
        <>
          <nav className="prx-periods" aria-label="Period">
            {PERIODS.map((p) => (
              <a key={p.key} href={`/health?period=${p.key}`} aria-current={p.key === period ? 'page' : undefined}>
                {p.label}
              </a>
            ))}
          </nav>

          <Charts data={data} />

          <h2 className="prx-section-title">Recent readings</h2>
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
        </>
      )}
    </Screen>
    </>
  );
}
