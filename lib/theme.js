import 'server-only';

/**
 * The admin's theme, as the CSS custom properties the admin computes.
 *
 * `config.theme.tokens.vars` is written once on the admin for every app that
 * shows the brand (storefront, this portal, the provider's embed), so the
 * mapping from theme settings to colours lives in one place and cannot drift.
 * This file only checks the values again before they reach a `<style>` tag;
 * `public/scss/main.scss` maps them onto the portal's own `--prx-*` names, with
 * neutral defaults for an admin that sends none.
 *
 * Fonts: the tokens name a family ("Public Sans", then a fallback stack). The
 * portal does NOT link the admin's font stylesheet — no third-party host on an
 * authenticated page — so a family applies only where the device has it or the
 * deployment self-hosts it. Everything else falls back to the system stack.
 */

/** A custom property name. Anything else is dropped. */
const PROPERTY = /^--[a-z0-9-]+$/;

/** Characters that could end the declaration or the `<style>` element, and url(). */
const UNSAFE = /[;{}<>\\]|url\(/i;

export function themeVariables(config) {
  const vars = config?.theme?.tokens?.vars;

  if (!vars || typeof vars !== 'object') return {};

  return Object.fromEntries(
    Object.entries(vars).filter(
      ([name, value]) => PROPERTY.test(name) && typeof value === 'string' && value.trim() !== '' && !UNSAFE.test(value)
    )
  );
}

/** The variables as declarations for a `:root` rule. */
export function themeStyle(config) {
  return Object.entries(themeVariables(config))
    .map(([name, value]) => `${name}:${value.trim()}`)
    .join(';');
}

/**
 * The deployment's name, or the neutral fallback. The admin sends an empty
 * string, not null, before Settings > Brand is filled in, so `??` is not enough.
 */
export function brandName(config) {
  const name = config?.brand?.name;

  return typeof name === 'string' && name.trim() !== '' ? name.trim() : 'Patient portal';
}

/**
 * The logo for a light background, or null. `brand.logo_light_url` is the
 * variant made for light backgrounds; `logo_url` is the default upload.
 * Only an https (or, in development, http) URL is used.
 */
export function brandLogo(config) {
  const brand = config?.brand ?? {};
  const url = [brand.logo_light_url, brand.logo_url].find((value) => typeof value === 'string' && /^https?:\/\//.test(value));

  return url ? { url, alt: brandName(config) } : null;
}
