import LocalTime from '@/components/ui/LocalTime';

/**
 * One measurement over time: the line, its target, and the latest reading.
 *
 * ── Why hand-rolled SVG ──────────────────────────────────────────────────────
 *
 * These are simple series with a target line — nothing a charting library adds
 * is needed, and a library would be a hardcoded dependency of the skeleton. SVG
 * also inherits the theme: every colour here is a CSS custom property read at
 * render time, so a re-brand needs no chart configuration. Canvas charts cannot
 * do that. This component is the swap boundary — a deployment that wants a
 * library replaces this file and keeps the props.
 *
 * ── The rules it follows (portal framework spec, "Charts") ───────────────────
 *
 * - A chart carries its target: the goal is a dashed line, labelled in place,
 *   drawn even when the series is short.
 * - The endpoint is emphasised — a ringed dot on the latest reading — and the
 *   plain-English sentence under the chart is what most people actually read.
 * - Colour never carries meaning alone: the goal line is labelled, the value is
 *   written out.
 * - A lab value carries its normal range as a shaded, labelled band, and each
 *   reading is marked by how it reads against it: outside the range a larger
 *   dot, critical a ringed one. The words are in the list beside the chart.
 *
 * ── Time ─────────────────────────────────────────────────────────────────────
 *
 * The x axis is proportional to real time, not one step per reading, so a gap
 * of three months looks like three months. The first and last dates are shown
 * through LocalTime, in the reader's timezone — the server's would be the wrong
 * day near midnight.
 *
 * Renders on the server; no client JavaScript beyond LocalTime.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {Array<{label: string, tone?: 'brand'|'muted', marks?: boolean, points: Array<{at: string, value: number, severity?: string}>}>} props.lines
 *   `marks` draws every reading, styled by its `severity` (critical, abnormal, normal, unknown)
 * @param {{value: number, label: string}|null} [props.target]
 * @param {{low: number|null, high: number|null, label: string}|null} [props.band]  a normal range; either end may be open
 * @param {string} props.summary  one sentence, already composed by the caller
 * @param {string} props.headline the latest value as it should read, e.g. "196.4 lbs"
 * @param {boolean} [props.bare]  no visible title or headline, for a chart inside a row that already shows both (still named for screen readers)
 */

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 14, right: 14, bottom: 10, left: 40 };

function round(value) {
  return Math.round(value * 10) / 10;
}

export default function TrendChart({ title, lines, target = null, band = null, summary, headline, bare = false }) {
  const points = lines.flatMap((line) => line.points);
  const times = points.map((point) => Date.parse(point.at)).filter((time) => !Number.isNaN(time));

  // Nothing placeable on a time axis. The admin drops unparseable instants, so
  // this is defence in depth — without it `new Date(Infinity)` throws below.
  if (times.length === 0) return null;

  const bandEdges = band ? [band.low, band.high].filter((edge) => typeof edge === 'number') : [];
  const values = [...points.map((point) => point.value), ...(target ? [target.value] : []), ...bandEdges];

  let low = Math.min(...values);
  let high = Math.max(...values);

  // A flat series still needs a band to sit in, or every point lands on one edge.
  if (high - low < 1) {
    low -= 1;
    high += 1;
  }

  const margin = (high - low) * 0.08;
  low -= margin;
  high += margin;

  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = last - first;

  const x = (at) => {
    if (span === 0) return PAD.left + (WIDTH - PAD.left - PAD.right) / 2;

    return PAD.left + ((Date.parse(at) - first) / span) * (WIDTH - PAD.left - PAD.right);
  };
  const y = (value) => PAD.top + ((high - value) / (high - low)) * (HEIGHT - PAD.top - PAD.bottom);

  const firstAt = new Date(first).toISOString();
  const lastAt = new Date(last).toISOString();
  const titleId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <figure className="prx-chart">
      {bare ? null : (
        <div className="prx-chart__head">
          <h2 className="prx-chart__title">{title}</h2>
          <p className="prx-chart__value">{headline}</p>
        </div>
      )}

      <svg
        className="prx-chart__plot"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${titleId}-title`}
        aria-describedby={`${titleId}-desc`}
      >
        {/* The name is the measurement and its latest value; the description is
            the period. The summary sentence is the visible figcaption, so it is
            not repeated here for a screen reader to hear twice. */}
        <title id={`${titleId}-title`}>{`${title}, latest ${headline}`}</title>
        <desc id={`${titleId}-desc`}>{`Readings from ${firstAt.slice(0, 10)} to ${lastAt.slice(0, 10)}.`}</desc>

        <text className="prx-chart__axis" x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">
          {round(high)}
        </text>
        <text className="prx-chart__axis" x={PAD.left - 6} y={HEIGHT - PAD.bottom} textAnchor="end">
          {round(low)}
        </text>
        <line className="prx-chart__baseline" x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} />

        {band && bandEdges.length > 0 ? (
          <g className="prx-chart__band">
            <rect
              x={PAD.left}
              width={WIDTH - PAD.left - PAD.right}
              y={typeof band.high === 'number' ? y(band.high) : PAD.top}
              height={(typeof band.low === 'number' ? y(band.low) : HEIGHT - PAD.bottom) - (typeof band.high === 'number' ? y(band.high) : PAD.top)}
            />
            <text x={PAD.left + 4} y={(typeof band.high === 'number' ? y(band.high) : PAD.top) + 10}>
              {band.label}
            </text>
          </g>
        ) : null}

        {target ? (
          <g className="prx-chart__target">
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(target.value)} y2={y(target.value)} />
            <text x={WIDTH - PAD.right} y={y(target.value) - 4} textAnchor="end">
              {target.label}
            </text>
          </g>
        ) : null}

        {lines.map((line) => {
          if (line.points.length === 0) return null;

          const tone = line.tone === 'muted' ? 'prx-chart__line--muted' : '';
          const latest = line.points.at(-1);

          return (
            <g key={line.label} className={`prx-chart__line ${tone}`}>
              {line.points.length > 1 ? (
                <polyline points={line.points.map((point) => `${x(point.at)},${y(point.value)}`).join(' ')} />
              ) : null}
              {line.marks
                ? line.points.slice(0, -1).map((point, index) => (
                    <circle
                      key={`${point.at}-${index}`}
                      className={`prx-chart__mark prx-chart__mark--${point.severity ?? 'unknown'}`}
                      cx={x(point.at)}
                      cy={y(point.value)}
                      r={point.severity === 'critical' || point.severity === 'abnormal' ? 3.5 : 2.5}
                    />
                  ))
                : null}
              <circle
                className={`prx-chart__ring${line.marks ? ` prx-chart__mark--${latest.severity ?? 'unknown'}` : ''}`}
                cx={x(latest.at)}
                cy={y(latest.value)}
                r="5"
              />
              <circle className="prx-chart__dot" cx={x(latest.at)} cy={y(latest.value)} r="2.5" />
            </g>
          );
        })}
      </svg>

      <div className="prx-chart__range prx-muted" aria-hidden="true">
        <LocalTime value={firstAt} format="date" />
        {span > 0 ? <LocalTime value={lastAt} format="date" /> : null}
      </div>

      {lines.length > 1 ? (
        <ul className="prx-chart__legend">
          {lines.map((line) => (
            <li key={line.label} className={line.tone === 'muted' ? 'prx-chart__key--muted' : 'prx-chart__key'}>
              {line.label}
            </li>
          ))}
        </ul>
      ) : null}

      <figcaption className="prx-chart__summary">{summary}</figcaption>
    </figure>
  );
}
