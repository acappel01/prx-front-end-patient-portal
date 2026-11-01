/**
 * Runs once when a server instance starts (`next start`, `next dev`).
 *
 * Checks the environment (lib/env.js) before the first request. In production
 * a missing or malformed required variable stops the server with one message
 * naming each problem, so a bad deploy fails at start instead of as "those
 * details did not match" on every sign-in. In development it only warns, so a
 * half-filled `.env` still renders pages.
 *
 * Not during `next build` (no env is needed to compile, and CI builds without
 * one) and not in the edge runtime (there is none here).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;

  const { assertEnv } = await import('./lib/env.js');

  try {
    assertEnv();
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[env] ${error.message}\n(development: starting anyway)`);

      return;
    }

    // Exit rather than throw: Next logs a thrown error here but keeps the
    // process up, unable to serve, so a service manager would think it is
    // running.
    console.error(`[env] ${error.message}`);
    process.exit(1);
  }
}
