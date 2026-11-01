import assert from 'node:assert/strict';
import { register } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

// The security rules in docs/security/dev.md, each with the case that broke it
// once (P-10). Server modules run under the stubs in scripts/support.
register('./support/hooks.mjs', import.meta.url);

process.env.ADMIN_API_BASE_URL = 'https://admin.example.test/api/v1';
process.env.PORTAL_URL = 'https://portal.example.test';
process.env.SESSION_SECRET = 'test-only-signing-key-not-a-real-secret-000';

const state = (globalThis.__test ??= { cookies: new Map(), headers: {}, after: [] });
const { isAllowed, safePath } = await import('../lib/portalProxy.js');
const session = await import('../lib/session.js');
const { customCss, themeStyle, themeVariables } = await import('../lib/theme.js');
const intakeRoute = await import('../app/api/intake/[id]/route.js');

const realWarn = console.warn;
const realFetch = globalThis.fetch;

beforeEach(() => {
  state.cookies.clear();
  state.cookieOptions?.clear();
  console.warn = () => {};
});

afterEach(() => {
  console.warn = realWarn;
  globalThis.fetch = realFetch;
});

const ID = '0b6f1c2e-6a0b-4c1e-9f3a-2d4e5f6a7b8c';

describe('proxy allowlist', () => {
  it('allows only the listed method and path', () => {
    assert.ok(isAllowed('POST', '/patient/vitals'));
    assert.ok(isAllowed('post', '/patient/vitals'));
    assert.ok(!isAllowed('GET', '/patient/vitals'));
    assert.ok(isAllowed('GET', `/patient/conversations/${ID}/messages`));
    assert.ok(isAllowed('POST', `/patient/approvals/${ID}/accept`));
    assert.ok(!isAllowed('POST', `/patient/approvals/${ID}/refund`));
    assert.ok(!isAllowed('GET', '/patient/home'), 'reads that a server screen makes are not exposed');
    assert.ok(!isAllowed('POST', '/patient/auth/login'));
  });

  it('keeps out the entries removed with no screen behind them', () => {
    assert.ok(!isAllowed('GET', '/patient/scheduling/slots'));
    assert.ok(!isAllowed('POST', '/patient/appointments'));
    assert.ok(!isAllowed('POST', `/patient/encounters/${ID}/video-token`));
    assert.ok(!isAllowed('POST', '/patient/link-chart'));
  });

  it('anchors every pattern, so a suffix or prefix cannot ride along', () => {
    assert.ok(!isAllowed('POST', '/patient/vitals/../auth/logout'));
    assert.ok(!isAllowed('POST', '/x/patient/vitals'));
    assert.ok(!isAllowed('POST', `/patient/approvals/${ID}/accept/extra`));
    assert.ok(!isAllowed('POST', '/patient/approvals/not-a-uuid/accept'));
  });

  it('safePath refuses an encoded slash, dot-segments, backslashes and NUL', () => {
    assert.equal(safePath(['patient', 'vitals']), '/patient/vitals');
    // Next has already decoded `%2F`, so it arrives as a slash inside ONE segment.
    assert.equal(safePath(['patient', 'conversations%2F..']), '/patient/conversations%2F..');
    assert.equal(safePath(['patient', 'a/../auth', 'logout']), null);
    assert.equal(safePath(['patient', '..', 'auth']), null);
    assert.equal(safePath(['patient', '.']), null);
    assert.equal(safePath(['patient', 'a\\b']), null);
    assert.equal(safePath(['patient', 'a\0']), null);
    assert.equal(safePath(['patient', '']), null);
    assert.equal(safePath([]), null);
    assert.equal(safePath('patient/vitals'), null);
  });
});

describe('signed cookies', () => {
  it('round-trips the session token, httpOnly, Secure, Strict, no max-age', async () => {
    await session.startSession('token-abc');

    assert.equal(await session.sessionToken(), 'token-abc');
    assert.deepEqual(state.cookieOptions.get('prx_session'), { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  });

  it('keeps live sessions valid: the session signature has no purpose prefix', async () => {
    const { createHmac } = await import('node:crypto');
    const signature = createHmac('sha256', process.env.SESSION_SECRET).update('legacy-token').digest('base64url');

    state.cookies.set('prx_session', `legacy-token.${signature}`);
    assert.equal(await session.sessionToken(), 'legacy-token');
  });

  it('refuses a tampered value, a bare token and a forged signature', async () => {
    await session.startSession('token-abc');
    const signed = state.cookies.get('prx_session');

    state.cookies.set('prx_session', signed.replace('token-abc', 'token-abd'));
    assert.equal(await session.sessionToken(), null);

    state.cookies.set('prx_session', 'token-abc');
    assert.equal(await session.sessionToken(), null);

    state.cookies.set('prx_session', 'token-abc.AAAA');
    assert.equal(await session.sessionToken(), null);
  });

  it('a challenge cookie copied into the session cookie never verifies (purpose separation)', async () => {
    await session.startChallenge('challenge-123');
    assert.equal(await session.challengeToken(), 'challenge-123');
    assert.equal(state.cookieOptions.get('prx_challenge').maxAge, 300);

    state.cookies.set('prx_session', state.cookies.get('prx_challenge'));
    assert.equal(await session.sessionToken(), null);

    await session.startSession('token-abc');
    state.cookies.set('prx_challenge', state.cookies.get('prx_session'));
    assert.equal(await session.challengeToken(), null);
  });

  it('the trusted-browser cookie is its own purpose and lives as long as the admin said', async () => {
    await session.startTrustedDevice('device-1', new Date(Date.now() + 3600_000).toISOString());

    assert.equal(await session.trustedDeviceToken(), 'device-1');
    assert.ok(Math.abs(state.cookieOptions.get('prx_device').maxAge - 3600) <= 1);

    state.cookies.set('prx_session', state.cookies.get('prx_device'));
    assert.equal(await session.sessionToken(), null);
  });

  it('readSigned/writeSigned are the one implementation', async () => {
    await session.writeSigned('x', 'v', 'device', 60);
    assert.equal(await session.readSigned('x', 'device'), 'v');
    assert.equal(await session.readSigned('x', 'challenge'), null);
  });

  it('refuses to sign without a secret', async () => {
    const secret = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    try {
      await assert.rejects(session.startSession('t'), /SESSION_SECRET/);
    } finally {
      process.env.SESSION_SECRET = secret;
    }
  });
});

describe('theme CSS sanitising', () => {
  it('keeps custom properties and drops anything that could escape or load', () => {
    const config = {
      theme: {
        tokens: {
          vars: {
            '--color-primary': '#123456',
            '--font-body': '"Public Sans", system-ui',
            '--bad;': 'red',
            'color': 'red',
            '--escape': 'red;}body{display:none',
            '--load': 'url(https://evil.example.test/x.png)',
            '--style': '</style><script>',
            '--slash': '\\75 rl(x)',
            '--empty': '  ',
          },
        },
      },
    };

    assert.deepEqual(themeVariables(config), { '--color-primary': '#123456', '--font-body': '"Public Sans", system-ui' });
    assert.equal(themeStyle(config), '--color-primary:#123456;--font-body:"Public Sans", system-ui');
    assert.deepEqual(themeVariables(null), {});
  });

  it('applies Custom CSS that loads nothing', () => {
    assert.equal(customCss({ theme: { custom_css: ':root{--font-display-stretch:118%}' } }), ':root{--font-display-stretch:118%}');
    assert.equal(customCss({ theme: { custom_css: '  ' } }), null);
  });

  for (const [name, css] of [
    ['url(', 'body{background:url(https://evil.example.test/x.png)}'],
    ['an escaped url (u\\72l)', 'body{background:u\\72l(https://evil.example.test/x.png)}'],
    ['URL( in capitals', 'body{background:URL(x)}'],
    ['@import', '@import "https://evil.example.test/x.css";'],
    ['image-set(', 'body{background:image-set("x.png" 1x)}'],
    ['a closing style tag', '</style><script>alert(1)</script>'],
    ['expression(', 'body{width:expression(alert(1))}'],
  ]) {
    it(`refuses Custom CSS with ${name}`, () => {
      assert.equal(customCss({ theme: { custom_css: css } }), null);
    });
  }
});

describe('intake upload cap', () => {
  const upload = (headers, body) =>
    intakeRoute.POST(
      new Request(`https://portal.example.test/api/intake/${ID}`, {
        method: 'POST',
        headers: { 'sec-fetch-site': 'same-origin', ...headers },
        body,
        duplex: 'half',
      }),
      { params: Promise.resolve({ id: ID }) }
    );

  beforeEach(async () => {
    await session.startSession('token-abc');
    globalThis.fetch = async () => {
      throw new Error('the admin must not be called');
    };
  });

  it('refuses a declared Content-Length over 42 MB before reading', async () => {
    const response = await upload({ 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(43 * 1024 * 1024) }, 'x');

    assert.equal(response.status, 413);
    assert.match((await response.json()).message, /under 10 MB/);
  });

  it('refuses a streamed body that passes the cap without declaring a length', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent++ < 43) controller.enqueue(chunk);
        else controller.close();
      },
    });

    const response = await upload({ 'content-type': 'multipart/form-data; boundary=x' }, stream);

    assert.equal(response.status, 413);
    assert.ok(sent < 45, 'stops reading at the cap');
  });

  it('refuses one photo over 10 MB, and a type that is not an image, without calling the admin', async () => {
    const big = new FormData();
    big.append('id_front', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' }), 'me.jpg');
    const encoded = new Response(big);

    let response = await upload({ 'content-type': encoded.headers.get('content-type') }, await encoded.arrayBuffer());
    assert.equal(response.status, 413);

    const svg = new FormData();
    svg.append('selfie_photo', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'me.svg');
    const encodedSvg = new Response(svg);

    response = await upload({ 'content-type': encodedSvg.headers.get('content-type') }, await encodedSvg.arrayBuffer());
    assert.equal(response.status, 422);
    assert.ok((await response.json()).errors.selfie_photo);
  });

  it('refuses a JSON body and a cross-origin post', async () => {
    assert.equal((await upload({ 'content-type': 'application/json' }, '{}')).status, 415);
    assert.equal(
      (
        await intakeRoute.POST(
          new Request(`https://portal.example.test/api/intake/${ID}`, { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'multipart/form-data; boundary=x' }, body: 'x' }),
          { params: Promise.resolve({ id: ID }) }
        )
      ).status,
      403
    );
  });

  it('sends a rebuilt form with neutral file names to the admin', async () => {
    const sent = [];
    globalThis.fetch = async (url, init) => {
      sent.push({ url: String(url), body: init.body });

      return Response.json({ data: { released: false } });
    };

    const form = new FormData();
    form.append('first_name', '  Pat  ');
    form.append('not_a_field', 'dropped');
    form.append('id_front', new Blob([new Uint8Array(10)], { type: 'image/png' }), 'passport-of-pat.png');
    const encoded = new Response(form);

    const response = await upload({ 'content-type': encoded.headers.get('content-type') }, await encoded.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(sent[0].url, `https://admin.example.test/api/v1/patient/encounters/${ID}/provide-information`);
    assert.equal(sent[0].body.get('first_name'), 'Pat');
    assert.equal(sent[0].body.get('not_a_field'), null);
    assert.equal(sent[0].body.get('id_front').name, 'id_front.png');
  });
});
