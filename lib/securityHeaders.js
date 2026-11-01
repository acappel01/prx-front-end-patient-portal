/**
 * The browser-side backstop: Content-Security-Policy, Strict-Transport-Security
 * and Permissions-Policy, set on every page by `middleware.js`.
 *
 * WHY. "No third-party script, font or asset host on an authenticated page"
 * (docs/security/dev.md) was enforced only by convention. One stray
 * `<script src>`, a dependency that injects a beacon, or an XSS through
 * admin-supplied text would otherwise run with nothing in the browser to stop
 * it, on pages that show prescriptions.
 *
 * WHAT THE PORTAL REALLY LOADS (keep this list true when adding a screen):
 *
 * - Scripts: only Next's own bundle from this origin, plus the inline bootstrap
 *   the App Router writes into every page. That inline script carries a
 *   per-request nonce: Next reads it from the request's CSP header, which the
 *   middleware sets. No other script exists, and no `<script>` tag may be added.
 * - Styles: the compiled stylesheet and `/fonts/stylesheet` from this origin,
 *   plus inline `<style>` (the theme tokens and Theme > Custom CSS, both checked
 *   in lib/theme.js) and `style=""` attributes (progress bars), hence
 *   `'unsafe-inline'` for styles only. A nonce cannot cover a style attribute,
 *   and a nonce in `style-src` would switch `'unsafe-inline'` off.
 * - Fonts: `/fonts/file/*` from this origin (lib/fonts.js relays them).
 * - Images: the brand logo and favicon from the admin (the origin of
 *   ADMIN_API_BASE_URL), and the two-step QR code, an admin-rendered SVG
 *   `data:` URI.
 * - Fetches: this origin only (`/api/*`). The browser never calls the admin.
 * - No frames, no video or voice SDK, no worker, no plugin.
 *
 * EXTENDING IT. A deployment adds sources per directive with an env var named
 * after it: `CSP_IMG_SRC`, `CSP_CONNECT_SRC`, `CSP_SCRIPT_SRC`, `CSP_STYLE_SRC`,
 * `CSP_FONT_SRC`, `CSP_FRAME_SRC`, `CSP_MEDIA_SRC`, `CSP_WORKER_SRC`, each a
 * space-separated list of hosts or schemes (`https://media.example.com`,
 * `https://*.example.net`, `blob:`). Brand uploads served from a storage or CDN
 * host, rather than the admin itself, need that host in `CSP_IMG_SRC`. Only
 * host and scheme sources are accepted, plus `'wasm-unsafe-eval'` for a future
 * SDK; anything else is dropped with a warning, so an env var cannot reopen
 * inline script. `PERMISSIONS_ALLOW` (e.g. `camera microphone`) lets this
 * origin use a device feature when a video visit ships; it stays off until then.
 *
 * Plain module, no Next imports: `node --test` imports it directly.
 */

/** @typedef {Record<string, string | undefined>} Env the process env, or a test's */

/** The directives a deployment may extend, and the env var for each. */
export const EXTENDABLE = Object.freeze({
  'img-src': 'CSP_IMG_SRC',
  'connect-src': 'CSP_CONNECT_SRC',
  'script-src': 'CSP_SCRIPT_SRC',
  'style-src': 'CSP_STYLE_SRC',
  'font-src': 'CSP_FONT_SRC',
  'frame-src': 'CSP_FRAME_SRC',
  'media-src': 'CSP_MEDIA_SRC',
  'worker-src': 'CSP_WORKER_SRC',
});

/** A scheme (`blob:`), or a host with optional scheme, wildcard, port and path. */
const HOST_OR_SCHEME = /^(?:[a-z][a-z0-9+.-]*:|(?:[a-z][a-z0-9+.-]*:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*(?::(?:\d{1,5}|\*))?(?:\/[^\s;,'"]*)?)$/i;
const KEYWORDS = new Set(["'wasm-unsafe-eval'"]);

/** Device features no screen uses. Each is `()` (nobody) unless PERMISSIONS_ALLOW names it. */
export const DEVICE_FEATURES = Object.freeze(['camera', 'microphone', 'geolocation']);

export const HSTS = 'max-age=31536000; includeSubDomains';

const warned = new Set();

function warnOnce(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * The admin's origin, from ADMIN_API_BASE_URL, or null when unset or not a URL.
 *
 * @param {Env} [env]
 */
export function adminOrigin(env = process.env) {
  try {
    const url = new URL(env.ADMIN_API_BASE_URL ?? '');

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * The sources a deployment added for `directive`, checked.
 *
 * @param {string} directive
 * @param {Env} [env]
 * @returns {string[]}
 */
export function extraSources(directive, env = process.env) {
  const name = EXTENDABLE[directive];
  const raw = name ? env[name] : undefined;

  if (typeof raw !== 'string' || raw.trim() === '') return [];

  return raw
    .trim()
    .split(/\s+/)
    .filter((token) => {
      if (KEYWORDS.has(token) || (HOST_OR_SCHEME.test(token) && !token.startsWith("'"))) return true;

      warnOnce(`[csp] ignored "${token}" in ${name}: only hosts, schemes and 'wasm-unsafe-eval' may be added`);

      return false;
    });
}

/**
 * The policy for one response. `nonce` is the per-request value the
 * middleware mints; `dev` adds what `next dev` needs (eval for React's
 * development build).
 */
/**
 * @param {{ nonce?: string, env?: Env, dev?: boolean }} [options]
 * @returns {string}
 */
export function contentSecurityPolicy({ nonce, env = process.env, dev = env.NODE_ENV === 'development' } = {}) {
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error('contentSecurityPolicy needs a per-request nonce of at least 16 base64 characters.');
  }

  const admin = adminOrigin(env);

  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', ...(admin ? [admin] : [])],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'frame-src': [],
    'media-src': [],
    'worker-src': [],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  for (const directive of Object.keys(EXTENDABLE)) {
    directives[directive] = [...new Set([...directives[directive], ...extraSources(directive, env)])];
  }

  return Object.entries(directives)
    // A directive with no sources is left out, so it falls back to default-src.
    .filter(([, sources]) => sources.length > 0)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * `camera=(), microphone=(), geolocation=()`, with any PERMISSIONS_ALLOW feature as `(self)`.
 *
 * @param {Env} [env]
 */
export function permissionsPolicy(env = process.env) {
  const allowed = new Set((env.PERMISSIONS_ALLOW ?? '').trim().split(/\s+/).filter(Boolean));

  return DEVICE_FEATURES.map((feature) => `${feature}=${allowed.has(feature) ? '(self)' : '()'}`).join(', ');
}

/** A fresh nonce: 16 random bytes, base64. Web Crypto, so it runs in any runtime. */
export function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return btoa(String.fromCharCode(...bytes));
}

/**
 * Every header the middleware sets, for one response.
 *
 * @param {{ nonce?: string, env?: Env }} [options]
 * @returns {Record<string, string>}
 */
export function securityHeaders({ nonce, env = process.env } = {}) {
  return {
    'Content-Security-Policy': contentSecurityPolicy({ nonce, env }),
    'Strict-Transport-Security': HSTS,
    'Permissions-Policy': permissionsPolicy(env),
  };
}

/**
 * Whether the policy's `img-src` lets the browser load `url`. Used by the root
 * layout to say, once, when a brand logo or favicon would be blocked: an
 * unbranded header is otherwise the only symptom.
 *
 * @param {string} url
 * @param {Env} [env]
 */
export function imageAllowed(url, env = process.env) {
  let target;
  try {
    target = new URL(url);
  } catch {
    return false;
  }

  if (target.protocol === 'data:') return true;

  const sources = [adminOrigin(env), ...extraSources('img-src', env)].filter(Boolean);

  return sources.some((source) => {
    if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return target.protocol === source.toLowerCase();

    // Paths are not compared: this only decides whether to warn.
    const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([^/:]+)(?::(\d+|\*))?/i.exec(source);
    if (!match) return false;

    const [, scheme, wildcard, host, port] = match;

    if (scheme && `${scheme.toLowerCase()}:` !== target.protocol) return false;
    if (port !== '*' && (port ?? '') !== target.port) return false;

    const name = host.toLowerCase();

    return wildcard ? target.hostname.endsWith(`.${name}`) : target.hostname === name;
  });
}

/**
 * Log, once per URL, a brand image the policy would block.
 *
 * @param {string | null | undefined} url
 * @param {string} what
 * @param {Env} [env]
 */
export function warnIfImageBlocked(url, what, env = process.env) {
  if (!url || !URL.canParse(url) || imageAllowed(url, env)) return;

  warnOnce(`[csp] the ${what} at ${new URL(url).origin} is not allowed by img-src, so browsers will not show it. Add that origin to CSP_IMG_SRC.`);
}
