import { portalOrigin } from './requestGuard.js';

/**
 * The deployment's environment, checked once at server start
 * (`instrumentation.js`), so a wrong value is a clear refusal to start rather
 * than a symptom later: a base URL without `/api/v1` made every sign-in fail as
 * "did not match", and a short secret quietly weakened the cookie signature.
 *
 * Required:
 * - `ADMIN_API_BASE_URL`: an http(s) URL whose path ends in `/api/v1` (the
 *   admin's origin plus `/api/v1`, never the storefront's).
 * - `SESSION_SECRET`: at least 32 bytes (`openssl rand -hex 32` gives 64).
 * - `PORTAL_URL`: this app's public http(s) origin (lib/requestGuard.js).
 *
 * Optional: `ADMIN_API_TOKEN` (only when the admin requires tokens for Public
 * read), the `CSP_*` extensions and `PERMISSIONS_ALLOW` (lib/securityHeaders.js).
 *
 * Never echoes a value: the messages name the variable and the rule only.
 * Plain module (relative import), so `node --test` imports it directly.
 */

export const MIN_SECRET_BYTES = 32;

/**
 * Everything wrong with `env`, one sentence per variable; empty when it is fine.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string[]}
 */
export function envProblems(env = process.env) {
  const problems = [];

  const base = env.ADMIN_API_BASE_URL;
  if (!base) {
    problems.push('ADMIN_API_BASE_URL is not set. Set it to the admin\'s origin plus /api/v1, e.g. https://admin.example.com/api/v1.');
  } else {
    let url = null;
    try {
      url = new URL(base);
    } catch {
      url = null;
    }

    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
      problems.push('ADMIN_API_BASE_URL is not an http(s) URL. Set it to the admin\'s origin plus /api/v1.');
    } else if (!/\/api\/v1\/?$/.test(url.pathname)) {
      problems.push('ADMIN_API_BASE_URL must end in /api/v1 (the admin\'s origin plus /api/v1, never the storefront\'s); every sign-in fails otherwise.');
    }
  }

  const secret = env.SESSION_SECRET;
  if (!secret) {
    problems.push('SESSION_SECRET is not set. Generate one with `openssl rand -hex 32`.');
  } else if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
    problems.push(`SESSION_SECRET is shorter than ${MIN_SECRET_BYTES} bytes. Generate one with \`openssl rand -hex 32\`.`);
  }

  // One rule for PORTAL_URL: the one requestGuard enforces on every write.
  try {
    portalOrigin(env.PORTAL_URL);
  } catch (error) {
    problems.push(error.message);
  }

  return problems;
}

/**
 * Throw one error listing every problem, or return quietly.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function assertEnv(env = process.env) {
  const problems = envProblems(env);

  if (problems.length > 0) {
    throw new Error(`The portal's environment is not set up, so it will not start:\n- ${problems.join('\n- ')}`);
  }
}
