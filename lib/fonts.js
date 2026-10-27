import 'server-only';

/**
 * The admin's brand fonts, served from this portal's own origin.
 *
 * The admin names a Google Fonts stylesheet (Settings > Theme > Font
 * stylesheet, sent as `theme.tokens.font_stylesheet`). Linking it directly
 * would put a third-party host on every authenticated page, and Google would
 * see each patient's address and the page they were on. So the portal fetches
 * the stylesheet server-side, rewrites every font file URL to `/fonts/file/…`,
 * and relays those files too. The browser only ever talks to the portal.
 *
 * Only `https://fonts.googleapis.com/css2?…` is fetched (the admin's own rule,
 * checked again here) and only font files under `https://fonts.gstatic.com/`
 * are relayed, so neither route can be pointed at another host. A relative
 * stylesheet path is the storefront's own file and has no meaning here, so it
 * is ignored: the system font stack applies.
 */

const STYLESHEET = /^https:\/\/fonts\.googleapis\.com\/css2?\?[^\s"'<>]+$/;
const FONT_HOST = 'https://fonts.gstatic.com/';
const FONT_FILE = /^[A-Za-z0-9_\-/.]+\.(woff2|woff|ttf|otf)$/;

// Google answers per browser. A current one gets woff2 with unicode ranges,
// which every browser the portal supports can use.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** The admin's Google Fonts stylesheet URL, or null. */
export function fontStylesheetUrl(config) {
  const url = config?.theme?.tokens?.font_stylesheet;

  return typeof url === 'string' && STYLESHEET.test(url.trim()) ? url.trim() : null;
}

/** The href for the layout's <link>, versioned so a theme change reaches browsers. */
export function fontStylesheetHref(config) {
  if (!fontStylesheetUrl(config)) return null;

  const version = config?.theme?.tokens?.version;

  return typeof version === 'string' && /^[a-f0-9]+$/.test(version) ? `/fonts/stylesheet?v=${version}` : '/fonts/stylesheet';
}

export function isFontFile(path) {
  return typeof path === 'string' && FONT_FILE.test(path) && !path.split('/').includes('..');
}

/**
 * Point every font URL at this origin. Returns null when anything is left that
 * would still load from elsewhere, so a changed upstream format fails closed
 * (system fonts) rather than open (a third-party request from a patient page).
 */
export function rewriteStylesheet(css) {
  const rewritten = css.replace(/url\(\s*(['"]?)https:\/\/fonts\.gstatic\.com\/([^'")\s]+)\1\s*\)/g, (match, _quote, path) =>
    isFontFile(path) ? `url(/fonts/file/${path})` : match
  );

  if (/url\(\s*['"]?(https?:)?\/\//i.test(rewritten) || /@import/i.test(rewritten)) return null;

  return rewritten;
}

/** Fetch and rewrite the stylesheet. Cached a day: it is the same for every visitor. */
export async function fetchFontStylesheet(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/css' },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  return rewriteStylesheet(await response.text());
}

/** Fetch one font file. Google's paths are versioned, so a file never changes. */
export async function fetchFontFile(path) {
  const response = await fetch(`${FONT_HOST}${path}`, {
    cache: 'force-cache',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) return null;

  return {
    body: await response.arrayBuffer(),
    type: response.headers.get('content-type') ?? 'font/woff2',
  };
}
