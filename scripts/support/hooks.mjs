/**
 * Module hooks for tests that import server code: `@/` resolves to the repo
 * root, and `server-only`, `next/headers` and `next/server` resolve to small
 * stubs (scripts/support/stubs), so a route handler runs under `node --test`
 * with a cookie jar and request headers the test controls. Registered by the
 * test file before it imports anything under app/ or lib/.
 */
const ROOT = new URL('../../', import.meta.url);

const STUBS = {
  'server-only': new URL('./stubs/server-only.mjs', import.meta.url).href,
  'next/headers': new URL('./stubs/next-headers.mjs', import.meta.url).href,
  'next/server': new URL('./stubs/next-server.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(STUBS, specifier)) return { url: STUBS[specifier], shortCircuit: true };

  if (specifier.startsWith('@/')) {
    const path = specifier.slice(2);

    return nextResolve(new URL(/\.[cm]?jsx?$/.test(path) ? path : `${path}.js`, ROOT).href, context);
  }

  return nextResolve(specifier, context);
}
