/**
 * The portal's icons, drawn inline.
 *
 * Inline SVG rather than text glyphs or an icon font: a symbol character
 * renders as an empty box on any device whose fonts lack it (the tab bar did
 * exactly that), and an icon font would mean a third-party host or a bundled
 * font file. These are a few Tabler outline icons (MIT, tabler.io/icons),
 * copied as path data, so they draw the same everywhere, take the text colour
 * through `currentColor`, and load nothing.
 *
 * Add an icon by copying its path data from Tabler into PATHS under a key
 * that names what it means here, not what it depicts.
 */
const PATHS = {
  home: ['M5 12l-2 0l9 -9l9 9l-2 0', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7', 'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6'],
  care: ['M4.5 12.5l8 -8a4.94 4.94 0 0 1 7 7l-8 8a4.94 4.94 0 0 1 -7 -7', 'M8.5 8.5l7 7'],
  talk: [
    'M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1',
  ],
  health: ['M3 12h4l3 8l4 -16l3 8h4'],
  record: [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z',
    'M9 9l1 0',
    'M9 13l6 0',
    'M9 17l6 0',
  ],
};

/** Decorative by default: the label next to it is what a screen reader reads. */
export default function Icon({ name, size = 24, className }) {
  const paths = PATHS[name];

  if (!paths) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
