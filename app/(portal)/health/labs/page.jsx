import TrendChart from '@/components/charts/TrendChart';
import LabFlag from '@/components/labs/LabFlag';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';
import { deploymentConfig } from '@/lib/adminApi';
import { changeText, formatNumber, formatValue, rangeText } from '@/lib/labs';

export const dynamic = 'force-dynamic';

/**
 * Lab results: what needs attention first, the values the install features,
 * every value with its chart, then the orders.
 *
 * One call (`/patient/labs`). The admin has already sorted the values (critical,
 * then outside range, then the rest), dropped anything not released to the
 * patient, and picked the featured ones; this page only lays them out.
 *
 * Clinical-safety rules this page keeps (plans/portal-health-features.md):
 * - A critical value is never a quiet colour. It is a notice in words that
 *   says who already knows, plus the emergency line, and no medical advice.
 * - Results the provider has not reviewed say so, so a patient reading a high
 *   value at 11pm knows a clinician will look at it.
 * - Every flag has a word and a glyph as well as a colour.
 * - Nothing clinical goes in the URL. Each value opens in place; the only
 *   links are to an order by its id.
 */

function dateText(iso) {
  if (!iso) return '';

  // A calendar date from the lab, not an instant: format it as written, in UTC,
  // so it never shifts a day in the reader's timezone.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function BiomarkerChart({ biomarker }) {
  const points = biomarker.series
    .filter((point) => typeof point.numeric === 'number' && point.at)
    .map((point) => ({ at: point.at, value: point.numeric, severity: point.severity }));

  if (points.length === 0) return null;

  const hasBand = typeof biomarker.ref_low === 'number' || typeof biomarker.ref_high === 'number';

  return (
    <TrendChart
      bare
      title={biomarker.name}
      headline={formatValue(biomarker.latest)}
      lines={[{ label: biomarker.name, marks: true, points }]}
      band={hasBand ? { low: biomarker.ref_low, high: biomarker.ref_high, label: 'Normal range' } : null}
      summary={[changeText(biomarker), rangeText(biomarker)].filter(Boolean).join(' ')}
    />
  );
}

function Biomarker({ biomarker, open = false }) {
  return (
    <details className={`prx-lab prx-lab--${biomarker.severity}`} id={`b-${biomarker.key}`} open={open}>
      <summary className="prx-lab__summary">
        <span className="prx-lab__name">{biomarker.name}</span>
        <span className="prx-lab__value">{formatValue(biomarker.latest)}</span>
        <LabFlag severity={biomarker.severity} direction={biomarker.direction} />
      </summary>

      <div className="prx-lab__body">
        <BiomarkerChart biomarker={biomarker} />
        {biomarker.series.length > 1 ? (
          <ul className="prx-rows">
            {[...biomarker.series].reverse().map((point, index) => (
              <li className="prx-row" key={`${point.at}-${index}`}>
                <span>{dateText(point.at)}</span>
                <span className="prx-lab__reading">
                  {formatValue(point)} <LabFlag severity={point.severity} direction={point.direction} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="prx-muted">{rangeText(biomarker)}</p>
        )}
        {biomarker.explanation ? <p className="prx-lab__about">{biomarker.explanation}</p> : null}
      </div>
    </details>
  );
}

function Featured({ tiles, byKey }) {
  if (tiles.length === 0) return null;

  return (
    <section aria-labelledby="featured-title">
      <h2 className="prx-section-title" id="featured-title">
        Your key values
      </h2>
      <ul className="prx-tiles">
        {tiles.map((tile) => {
          const biomarker = byKey.get(tile.key);

          return (
            <li key={tile.key}>
              <a className={`prx-tile prx-tile--${biomarker.severity}`} href={`#b-${tile.key}`}>
                <span className="prx-tile__label">{tile.label}</span>
                <span className="prx-tile__value">{formatValue(biomarker.latest)}</span>
                <LabFlag severity={biomarker.severity} direction={biomarker.direction} />
                <span className="prx-tile__date prx-muted">{dateText(biomarker.latest?.at)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Orders({ orders }) {
  return (
    <section aria-labelledby="orders-title">
      <h2 className="prx-section-title" id="orders-title">
        Lab orders
      </h2>
      <ul className="prx-rows prx-record-links">
        {orders.map((order) => (
          <li className="prx-row" key={order.id}>
            <a href={`/health/labs/${order.id}`}>
              <span>
                {order.panel ?? 'Lab order'}
                <span className="prx-row__meta"> · {dateText(order.results_at ?? order.ordered_at)}</span>
                <br />
                <span className="prx-row__meta">{order.stage_label}</span>
              </span>
              {order.critical ? <LabFlag severity="critical" /> : order.flagged ? <LabFlag severity="abnormal" /> : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function LabsPage() {
  // With health tracking off, Lab results IS the Health tab: no way back to a
  // progress screen that redirects here.
  const config = await deploymentConfig();
  const tracking = config?.portal?.modules?.vitals !== false;

  return (
    <>
      {tracking ? <BackLink href="/health" label="Your progress" /> : null}
      <Screen
        title="Lab results"
        path="/patient/labs"
        rowsOf={(data) => data?.orders}
        empty="When you have lab results, they appear here with each value marked against its normal range."
      >
        {(orders, data) => {
          const biomarkers = data.biomarkers ?? [];
          const byKey = new Map(biomarkers.map((biomarker) => [biomarker.key, biomarker]));
          const tiles = (data.featured ?? []).filter((tile) => byKey.has(tile.key));
          const summary = data.summary ?? {};

          return (
            <>
              {summary.critical > 0 ? (
                <div className="prx-notice prx-notice--critical" role="alert">
                  <strong>
                    {summary.critical === 1 ? 'One of your values is' : `${summary.critical} of your values are`} in the critical range.
                  </strong>{' '}
                  Your care team has been alerted and will review {summary.critical === 1 ? 'it' : 'them'} with you. If you feel unwell now,
                  call 911 or go to the nearest emergency room.
                </div>
              ) : null}

              {summary.awaiting_review > 0 ? (
                <p className="prx-notice">
                  Some results are not yet reviewed by your provider. They are shown as the lab reported them, with values outside the
                  normal range marked.
                </p>
              ) : null}

              <Featured tiles={tiles} byKey={byKey} />

              {biomarkers.length > 0 ? (
                <section aria-labelledby="values-title">
                  <h2 className="prx-section-title" id="values-title">
                    All values
                    {summary.flagged > 0 ? (
                      <span className="prx-row__meta"> · {formatNumber(summary.flagged)} outside the normal range</span>
                    ) : null}
                  </h2>
                  {biomarkers.map((biomarker, index) => (
                    <Biomarker key={biomarker.key} biomarker={biomarker} open={index === 0 && biomarker.severity === 'critical'} />
                  ))}
                </section>
              ) : (
                <p className="prx-muted">Your results will show here once the lab sends them.</p>
              )}

              <Orders orders={orders} />
            </>
          );
        }}
      </Screen>
    </>
  );
}
