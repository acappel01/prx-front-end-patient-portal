import assert from 'node:assert/strict';
import { register } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

// The headers module is plain; the font relay imports server code, so the
// hooks resolve `@/` and stub `server-only`.
register('./support/hooks.mjs', import.meta.url);

const {
  adminOrigin,
  contentSecurityPolicy,
  extraSources,
  imageAllowed,
  newNonce,
  permissionsPolicy,
  securityHeaders,
} = await import('../lib/securityHeaders.js');

process.env.ADMIN_API_BASE_URL = 'https://admin.example.test/api/v1';

const fonts = await import('../lib/fonts.js');
const route = await import('../app/fonts/file/[...path]/route.js');

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';
const ENV = { ADMIN_API_BASE_URL: 'https://admin.example.test/api/v1', NODE_ENV: 'production' };

/** The policy as { directive: [sources] }. */
function parse(policy) {
  return Object.fromEntries(policy.split('; ').map((part) => {
    const [name, ...sources] = part.split(' ');

    return [name, sources];
  }));
}

const realWarn = console.warn;
let warned;

beforeEach(() => {
  warned = [];
  console.warn = (line) => warned.push(String(line));
});

afterEach(() => {
  console.warn = realWarn;
});

describe('Content-Security-Policy (P-07)', () => {
  it('allows only this origin, the nonce, and the admin for images', () => {
    const csp = parse(contentSecurityPolicy({ nonce: NONCE, env: ENV }));

    assert.deepEqual(csp['default-src'], ["'self'"]);
    assert.deepEqual(csp['script-src'], ["'self'", `'nonce-${NONCE}'`]);
    assert.deepEqual(csp['style-src'], ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(csp['img-src'], ["'self'", 'data:', 'https://admin.example.test']);
    assert.deepEqual(csp['font-src'], ["'self'"]);
    assert.deepEqual(csp['connect-src'], ["'self'"]);
    assert.deepEqual(csp['object-src'], ["'none'"]);
    assert.deepEqual(csp['base-uri'], ["'none'"]);
    assert.deepEqual(csp['form-action'], ["'self'"]);
    assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
    // Unextended directives are left out, so they fall back to default-src.
    assert.equal(csp['frame-src'], undefined);
  });

  it('never allows inline or eval script in production', () => {
    const policy = contentSecurityPolicy({ nonce: NONCE, env: ENV });

    assert.doesNotMatch(parse(policy)['script-src'].join(' '), /unsafe/);
  });

  it('adds eval for next dev only', () => {
    assert.ok(parse(contentSecurityPolicy({ nonce: NONCE, env: { ...ENV, NODE_ENV: 'development' } }))['script-src'].includes("'unsafe-eval'"));
  });

  it('refuses to build a policy without a real nonce', () => {
    assert.throws(() => contentSecurityPolicy({ env: ENV }));
    assert.throws(() => contentSecurityPolicy({ nonce: "x' 'unsafe-inline", env: ENV }));
  });

  it('a fresh nonce per call, valid for the policy', () => {
    const [a, b] = [newNonce(), newNonce()];

    assert.notEqual(a, b);
    assert.doesNotThrow(() => contentSecurityPolicy({ nonce: a, env: ENV }));
  });

  it('works without ADMIN_API_BASE_URL (images from this origin only)', () => {
    assert.equal(adminOrigin({}), null);
    assert.deepEqual(parse(contentSecurityPolicy({ nonce: NONCE, env: {} }))['img-src'], ["'self'", 'data:']);
  });

  it('is extended per directive from env, hosts and schemes only', () => {
    const env = { ...ENV, CSP_IMG_SRC: 'https://media.example.test  https://*.cdn.example.test', CSP_FRAME_SRC: 'https://video.example.test', CSP_WORKER_SRC: 'blob:' };
    const csp = parse(contentSecurityPolicy({ nonce: NONCE, env }));

    assert.deepEqual(csp['img-src'], ["'self'", 'data:', 'https://admin.example.test', 'https://media.example.test', 'https://*.cdn.example.test']);
    assert.deepEqual(csp['frame-src'], ['https://video.example.test']);
    assert.deepEqual(csp['worker-src'], ['blob:']);
  });

  it('an env var cannot reopen inline script or end the directive', () => {
    const env = { ...ENV, CSP_SCRIPT_SRC: "'unsafe-inline' 'wasm-unsafe-eval' https://sdk.example.test;img-src * *" };

    assert.deepEqual(extraSources('script-src', env), ["'wasm-unsafe-eval'"]);
    assert.ok(warned.some((line) => line.includes("'unsafe-inline'")));
    assert.doesNotMatch(contentSecurityPolicy({ nonce: NONCE, env }), /unsafe-inline'[^;]*nonce|;img-src \*/);
  });
});

describe('HSTS and Permissions-Policy (P-07)', () => {
  it('sets HSTS for a year with subdomains', () => {
    assert.equal(securityHeaders({ nonce: NONCE, env: ENV })['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  });

  it('turns camera, microphone and geolocation off unless PERMISSIONS_ALLOW names one', () => {
    assert.equal(permissionsPolicy({}), 'camera=(), microphone=(), geolocation=()');
    assert.equal(permissionsPolicy({ PERMISSIONS_ALLOW: 'camera microphone' }), 'camera=(self), microphone=(self), geolocation=()');
  });
});

describe('imageAllowed (brand logo check)', () => {
  it('the admin origin, data: and CSP_IMG_SRC hosts are allowed; others are not', () => {
    const env = { ...ENV, CSP_IMG_SRC: 'https://*.cdn.example.test https://media.example.test:8443' };

    assert.ok(imageAllowed('https://admin.example.test/storage/logo.png', env));
    assert.ok(imageAllowed('data:image/svg+xml;base64,AAAA', env));
    assert.ok(imageAllowed('https://a.cdn.example.test/logo.svg', env));
    assert.ok(imageAllowed('https://media.example.test:8443/logo.svg', env));
    assert.ok(!imageAllowed('https://media.example.test/logo.svg', env));
    assert.ok(!imageAllowed('https://cdn.example.test/logo.svg', env));
    assert.ok(!imageAllowed('http://admin.example.test/logo.png', env));
    assert.ok(!imageAllowed('https://elsewhere.example.test/logo.png', env));
  });
});

describe('font relay serves only the brand\'s own files (P-19)', () => {
  const realFetch = globalThis.fetch;
  const STYLESHEET = 'https://fonts.googleapis.com/css2?family=Public+Sans';
  const NAMED = 's/publicsans/v18/abc.woff2';
  let requested;

  function google({ stylesheet = STYLESHEET, css } = {}) {
    globalThis.fetch = async (url) => {
      requested.push(String(url));

      if (String(url).endsWith('/config')) return Response.json({ data: { theme: { tokens: { font_stylesheet: stylesheet } } } });
      if (String(url).startsWith('https://fonts.googleapis.com/')) {
        return new Response(css ?? `@font-face{font-family:'Public Sans';src:url(https://fonts.gstatic.com/${NAMED}) format('woff2')}`);
      }
      if (String(url).startsWith('https://fonts.gstatic.com/')) return new Response('font-bytes', { headers: { 'content-type': 'font/woff2' } });

      return new Response(null, { status: 404 });
    };
  }

  const get = (path) => route.GET(new Request(`https://portal.example.test/fonts/file/${path}`), { params: Promise.resolve({ path: path.split('/') }) });

  beforeEach(() => {
    requested = [];
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('rewrites gstatic URLs and drops a stylesheet that would load from anywhere else', () => {
    assert.equal(fonts.rewriteStylesheet(`src:url(https://fonts.gstatic.com/${NAMED})`), `src:url(/fonts/file/${NAMED})`);
    assert.equal(fonts.rewriteStylesheet(`src:url(https://fonts.gstatic.com/${NAMED}),url(https://evil.example.test/x.woff2)`), null);
    assert.equal(fonts.rewriteStylesheet(`@import url(/x.css);src:url(https://fonts.gstatic.com/${NAMED})`), null);
    assert.equal(fonts.rewriteStylesheet('src:url(//evil.example.test/x.woff2)'), null);
  });

  it('collects the file paths the stylesheet names', () => {
    assert.deepEqual([...fonts.stylesheetFontPaths(`a{src:url(/fonts/file/${NAMED})}b{src:url(/fonts/file/s/x/../y.woff2)}`)], [NAMED]);
    assert.deepEqual([...fonts.stylesheetFontPaths(null)], []);
  });

  it('relays a file the brand stylesheet names', async () => {
    google();
    const response = await get(NAMED);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'font-bytes');
    assert.ok(requested.includes(`https://fonts.gstatic.com/${NAMED}`));
  });

  it('a real Google font the stylesheet does not name is a 404, never fetched', async () => {
    google();
    const response = await get('s/roboto/v30/other.woff2');

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!requested.some((url) => url.startsWith('https://fonts.gstatic.com/')));
  });

  it('serves nothing when the brand names no stylesheet, or it fails closed', async () => {
    google({ stylesheet: null });
    assert.equal((await get(NAMED)).status, 404);

    google({ css: `src:url(https://fonts.gstatic.com/${NAMED}),url(https://evil.example.test/x.woff2)` });
    assert.equal((await get(NAMED)).status, 404);
    assert.ok(!requested.some((url) => url.startsWith('https://fonts.gstatic.com/')));
  });

  it('refuses a path that is not a font file before asking anyone', async () => {
    google();
    assert.equal((await get('s/../../etc/passwd')).status, 404);
    assert.deepEqual(requested, []);
  });
});
