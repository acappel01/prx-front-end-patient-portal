import 'server-only';

/**
 * Turn the admin's theme settings into CSS custom properties.
 *
 * Every value here comes from the deployment's configuration. Nothing in this
 * repository knows a brand colour, a font, or a product name — a new client
 * deployment must need zero code changes, and a hardcoded value is exactly how
 * a skeleton quietly becomes a fork.
 *
 * Values are sanitised before injection because they land in a `<style>` block.
 * They come from a permission-gated admin rather than a visitor, so this is
 * defence in depth, not the primary control — but a stray `}` in a colour field
 * would break every rule after it, and that is a support call either way.
 */

/** Allow hex, rgb/rgba, hsl/hsla and bare CSS keywords. Reject everything else. */
const COLOR = /^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\([0-9.,%\s/-]+\)|[a-zA-Z-]{3,32})$/;

function safeColor(value, fallback) {
  return typeof value === 'string' && COLOR.test(value.trim()) ? value.trim() : fallback;
}

/** A font stack: names, quotes, commas and spaces. No braces, no semicolons, no url(). */
function safeFont(value, fallback) {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();

  return /^[-\w\s'",]{1,160}$/.test(trimmed) ? trimmed : fallback;
}

/**
 * The default palette is intentionally neutral — greys and a single blue. It
 * exists so an unconfigured deployment renders legibly, NOT so it looks like a
 * brand. If a screenshot of the unconfigured portal looks designed, someone has
 * put a brand in the skeleton.
 */
const DEFAULTS = {
  '--prx-brand': '#2563eb',
  '--prx-brand-ink': '#ffffff',
  '--prx-urgent': '#b91c1c',
  '--prx-warn': '#b45309',
  '--prx-warn-wash': '#fffbeb',
  '--prx-ok': '#15803d',
  '--prx-bg': '#f6f7f9',
  '--prx-surface': '#ffffff',
  '--prx-ink': '#111827',
  '--prx-ink-2': '#4b5563',
  '--prx-ink-3': '#9ca3af',
  '--prx-line': '#e5e7eb',
  '--prx-font-body': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  '--prx-font-display': 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/**
 * Look up a palette colour by NAME.
 *
 * `theme.palette` is the install's named colour vocabulary — `{name, color}`
 * rows the operator edits. Resolving by name rather than storing a hex means
 * retuning a colour in the admin moves everything using it.
 */
function fromPalette(palette, name, fallback) {
  if (!Array.isArray(palette) || !name) return fallback;

  const row = palette.find((entry) => entry?.name === name);

  return row?.color ? safeColor(row.color, fallback) : fallback;
}

/**
 * Map the admin's config onto our tokens.
 *
 * FIELD NAMES ARE TAKEN FROM THE LIVE PAYLOAD, not from what they ought to be.
 * The first version of this file read `primary_contrast_color`, `urgent_color`
 * and `site.name` — none of which exist. Every one silently fell back to a
 * default, so the portal rendered its own greys while reporting success. The
 * real keys are `accent_color` / `accent_secondary_color` under `theme`, and
 * the brand name is `brand.name`.
 */
export function themeVariables(config) {
  const theme = config?.theme ?? {};
  const palette = theme.palette;

  const brand = safeColor(theme.primary_color, DEFAULTS['--prx-brand']);

  return {
    ...DEFAULTS,
    '--prx-brand': brand,
    // No contrast field exists upstream, so derive it from the brand colour
    // rather than shipping a fixed one that goes unreadable on a light brand.
    '--prx-brand-ink': readableOn(brand, DEFAULTS['--prx-brand-ink']),
    '--prx-accent': safeColor(theme.accent_color, brand),
    '--prx-accent-2': safeColor(theme.accent_secondary_color, brand),
    // Urgency is the one colour the operator must be able to move — it is the
    // tier-0 card. Prefer a palette entry named "urgent"/"danger" before the
    // built-in red, so it is configurable without a new settings field.
    '--prx-urgent': fromPalette(
      palette,
      ['urgent', 'danger', 'alert'].find((n) => (palette ?? []).some((e) => e?.name === n)),
      DEFAULTS['--prx-urgent']
    ),
    '--prx-bg': safeColor(theme.background_color, DEFAULTS['--prx-bg']),
    '--prx-ink': safeColor(theme.text_color, DEFAULTS['--prx-ink']),
    // The admin stores a bare family name ("DM Sans"), not a stack. Append a
    // real fallback or a device without that font renders in whatever the
    // browser feels like. We do NOT load it — no third-party host on an
    // authenticated page — so this applies only where the font is already
    // present or self-hosted by the deployment.
    '--prx-font-body': withFallback(theme.font_body, DEFAULTS['--prx-font-body']),
    '--prx-font-display': withFallback(theme.font_display, DEFAULTS['--prx-font-display']),
  };
}

/** Black or white, whichever is readable on `hex`. */
function readableOn(hex, fallback) {
  const match = /^#([0-9a-f]{6})$/i.exec((hex ?? '').trim());

  if (!match) return fallback;

  const int = parseInt(match[1], 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;

    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });

  // WCAG relative luminance. The 0.179 threshold is the point where contrast
  // against white and against black are equal — NOT 0.5, which is the mistake
  // that puts white text on a mid-tone brand.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000000' : '#ffffff';
}

function withFallback(name, fallback) {
  const safe = safeFont(name, null);

  if (!safe) return fallback;

  // Already a stack — leave it alone.
  return safe.includes(',') ? safe : `"${safe.replace(/"/g, '')}", ${fallback}`;
}

/** Render the variables as an inline style string for the root element. */
export function themeStyle(config) {
  return Object.entries(themeVariables(config))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}
