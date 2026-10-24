import { flagOf } from '@/lib/labs';

/**
 * How one value reads against its range: a word, a glyph and a colour, so it
 * reads the same without colour. A critical value is bold and outlined.
 */
export default function LabFlag({ severity, direction }) {
  const flag = flagOf(severity, direction);

  return (
    <span className={`prx-flag prx-flag--${flag.tone}`}>
      <span className="prx-flag__glyph" aria-hidden="true">
        {flag.glyph}
      </span>
      {flag.text}
    </span>
  );
}
