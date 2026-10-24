/**
 * Wording for lab values, shared by the Lab results list and an order's page.
 *
 * The admin decides severity and direction (from the provider's own flags);
 * this file only words them. It never says whether a value is good or bad for
 * the patient, or what to do about it: that is the care team's job, and the
 * same number means different things on different treatments.
 */

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatNumber(value) {
  return typeof value === 'number' ? NUMBER.format(value) : '';
}

/** "1,250 ng/dL", or the lab's own text ("<5") when it is not a plain number. */
export function formatValue(point) {
  if (!point) return '';

  const value = point.value ?? (typeof point.numeric === 'number' ? formatNumber(point.numeric) : '');

  return [value, point.unit].filter(Boolean).join(' ');
}

/** Badge text and glyph. Colour is never the only signal: every badge has words. */
export function flagOf(severity, direction) {
  const way = direction === 'high' ? 'high' : direction === 'low' ? 'low' : null;

  switch (severity) {
    case 'critical':
      return { tone: 'critical', glyph: '!', text: way ? `Critical ${way}` : 'Critical' };
    case 'abnormal':
      return {
        tone: 'abnormal',
        glyph: way === 'low' ? '▼' : way === 'high' ? '▲' : '•',
        text: way ? (way === 'high' ? 'High' : 'Low') : 'Outside range',
      };
    case 'normal':
      return { tone: 'normal', glyph: '✓', text: 'In range' };
    default:
      return { tone: 'unknown', glyph: '–', text: 'No range given' };
  }
}

/** "Normal range 264–916 ng/dL", one-sided ranges, or the lab's own text. */
export function rangeText(item) {
  const unit = item.unit ? ` ${item.unit}` : '';
  const low = typeof item.ref_low === 'number' ? formatNumber(item.ref_low) : null;
  const high = typeof item.ref_high === 'number' ? formatNumber(item.ref_high) : null;

  if (low !== null && high !== null) return `Normal range ${low}–${high}${unit}`;
  if (low !== null) return `Normal range ${low}${unit} or above`;
  if (high !== null) return `Normal range ${high}${unit} or below`;
  if (item.ref_text) return `Lab's range: ${item.ref_text}`;

  return 'The lab gave no range for this value.';
}

/** "Up 12% since your previous result." Direction of travel only, never a verdict. */
export function changeText(biomarker) {
  const pct = biomarker.change?.pct;

  if (typeof pct !== 'number') return biomarker.series?.length > 1 ? null : 'Your first result for this value.';
  if (pct === 0) return 'No change since your previous result.';

  return `${pct > 0 ? 'Up' : 'Down'} ${formatNumber(Math.abs(pct))}% since your previous result.`;
}
