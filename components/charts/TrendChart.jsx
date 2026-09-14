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
 * @param {Array<{label: string, tone?: 'brand'|'muted', points: Array<{at: string, value: number}>}>} props.lines
 * @param {{value: number, label: string}|null} [props.target]
 * @param {string} props.summary  one sentence, already composed by the caller
 * @param {string} props.headline the latest value as it should read, e.g. "196.4 lbs"
 */

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 24, right: 14, bottom: 10, left: 40 };

function round(value) {
  return Math.round(value * 10) / 10;
}

export default function TrendChart({ title, lines, target = null, summary, headline }) {
  const points = lines.flatMap((line) => line.points);
  const times = points.map((point) => Date.parse(point.at)).filter((time) => !Number.isNaN(time));

  // Nothing placeable on a time axis. The admin drops unparseable instants, so
  // this is defence in depth — without it `new Date(Infinity)` throws below.
  if (times.length === 0) return null;

  const values = [...points.map((point) => point.value), ...(target ? [target.value] : [])];

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
      <div className="prx-chart__head">
        <h2 className="prx-chart__title">{title}</h2>
        <p className="prx-chart__value">{headline}</p>
      </div>

      <svg
        className="prx-chart__plot"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${titleId}-title`}
        aria-describedby={`${titleId}-desc`}
      >
        {/* The name is the measurement and its latest value; the description is
            the number of readings. The local date range is visible below; the
            summary sentence is the visible figcaption, so it is
            not repeated here for a screen reader to hear twice. */}
        <title id={`${titleId}-title`}>{`${title}, latest ${headline}`}</title>
        <desc id={`${titleId}-desc`}>{span === 0 ? 'Readings at one recorded time.' : 'Readings plotted proportionally over time. The date range follows the chart.'}</desc>

        <text className="prx-chart__axis" x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">
          {round(high)}
        </text>
        <text className="prx-chart__axis" x={PAD.left - 6} y={HEIGHT - PAD.bottom} textAnchor="end">
          {round(low)}
        </text>
        <line className="prx-chart__baseline" x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} />

        {/* Draw the goal over the reading lines so a flat series at the goal
            cannot hide its dashes; endpoint rings remain on top of both. */}
        {lines.map((line) => line.points.length > 1 ? (
          <g key={line.label} className={`prx-chart__line ${line.tone === 'muted' ? 'prx-chart__line--muted' : ''}`}>
            <polyline points={line.points.map((point) => `${x(point.at)},${y(point.value)}`).join(' ')} />
          </g>
        ) : null)}

        {target ? (
          <g className="prx-chart__target">
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(target.value)} y2={y(target.value)} />
          </g>
        ) : null}

        {lines.map((line) => {
          if (line.points.length === 0) return null;

          const tone = line.tone === 'muted' ? 'prx-chart__line--muted' : '';
          const latest = line.points.at(-1);

          return (
            <g key={line.label} className={`prx-chart__line ${tone}`}>
              <circle className="prx-chart__ring" cx={x(latest.at)} cy={y(latest.value)} r="5" />
              <circle className="prx-chart__dot" cx={x(latest.at)} cy={y(latest.value)} r="2.5" />
            </g>
          );
        })}
        {target ? (
          <text className="prx-chart__target-label" x={WIDTH - PAD.right} y={y(target.value) - 10} textAnchor="end">
            {target.label}
          </text>
        ) : null}
      </svg>

      <div className="prx-chart__range prx-muted">
        <span className="prx-visually-hidden">{span > 0 ? 'From ' : 'Recorded '}</span>
        <LocalTime value={firstAt} format="date" />
        {span > 0 ? <span><span className="prx-visually-hidden">to </span><LocalTime value={lastAt} format="date" /></span> : null}
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
