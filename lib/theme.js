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
 * admin's font stylesheet is relayed through this origin (lib/fonts.js), never
 * linked directly: no third-party host on an authenticated page.
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

/** The admin's https (or, in development, http) URL in `value`, or null. */
function adminUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value) ? value : null;
}

/**
 * The logo for a light background, or null. `brand.logo_light_url` is the
 * variant made for light backgrounds; `logo_url` is the default upload.
 * Only an https (or, in development, http) URL is used.
 */
export function brandLogo(config) {
  const brand = config?.brand ?? {};
  const url = [brand.logo_light_url, brand.logo_url].map(adminUrl).find(Boolean);

  return url ? { url, alt: brandName(config) } : null;
}

/** The favicon uploaded in Settings > Brand, or null. */
export function brandFavicon(config) {
  return adminUrl(config?.brand?.favicon_url);
}

/**
 * Settings > Theme > Custom CSS, which the website applies too, so a rule the
 * admin writes there (such as `--font-display-stretch`) reaches the portal.
 * `<html data-app="portal">` lets a rule target only the portal, or skip it.
 *
 * Refused whole when it could load anything (`url(`, `image-set(`, `@import`)
 * or escape its <style> element, because a patient page loads nothing from
 * another host. Escapes are refused too: `u\72l(` is `url(`.
 */
const LOADS_OR_ESCAPES = /<|\\|@import|url\(|image-set\(|expression\(/i;

export function customCss(config) {
  const css = config?.theme?.custom_css;

  if (typeof css !== 'string' || css.trim() === '') return null;

  if (LOADS_OR_ESCAPES.test(css)) {
    console.warn('[theme] Theme > Custom CSS was not applied to the portal: it loads a file (url, image-set or @import) or contains < or \\.');

    return null;
  }

  return css;
}
