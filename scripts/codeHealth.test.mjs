import assert from 'node:assert/strict';
import { register } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

// The shared helpers every screen and form now goes through (P-08), and the
// startup env check (P-14).
register('./support/hooks.mjs', import.meta.url);

const { apiCall, fieldErrors, portalCall } = await import('../lib/portalClient.js');
const { guard } = await import('../lib/screenGuards.js');
const { UUID_PATTERN, isUuid } = await import('../lib/ids.js');
const { TWO_FACTOR_SETUP_PATH, landingFor } = await import('../lib/landing.js');
const { MIN_SECRET_BYTES, assertEnv, envProblems } = await import('../lib/env.js');

const realFetch = globalThis.fetch;
let calls;
let navigations;

function browser(handler) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    return handler(String(url), init);
  };
}

beforeEach(() => {
  calls = [];
  navigations = [];
  globalThis.window = {
    location: {
      assign: (url) => navigations.push(url),
      reload: () => navigations.push('reload'),
    },
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete globalThis.window;
});

describe('portalCall / apiCall (P-08)', () => {
  it('sends JSON to the proxy and unwraps the envelope', async () => {
    browser(() => Response.json({ data: { id: 'm1' }, meta: { current_page: 2 }, message: 'Saved.' }, { status: 201 }));

    const result = await portalCall('/patient/vitals', { method: 'POST', body: { weight_lbs: 180 }, headers: { 'Idempotency-Key': 'key-12345678' } });

    assert.equal(calls[0].url, '/api/portal/patient/vitals');
    assert.equal(calls[0].init.body, '{"weight_lbs":180}');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].init.headers['Idempotency-Key'], 'key-12345678');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.deepEqual([result.ok, result.status, result.data, result.meta, result.message], [true, 201, { id: 'm1' }, { current_page: 2 }, 'Saved.']);
  });

  it('a GET sends no body and no Content-Type', async () => {
    browser(() => Response.json({ data: [] }));
    await portalCall('/patient/conversations');

    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.body, undefined);
    assert.equal(calls[0].init.headers['Content-Type'], undefined);
  });

  it('sends FormData as is, letting the browser set the boundary', async () => {
    browser(() => Response.json({ data: { released: true } }));
    const form = new FormData();
    form.append('first_name', 'Pat');

    await apiCall('/api/intake/x', { method: 'POST', body: form });

    assert.equal(calls[0].init.body, form);
    assert.equal(calls[0].init.headers['Content-Type'], undefined);
  });

  it('never throws: a network failure is status 0 with everything else null', async () => {
    browser(() => {
      throw new TypeError('Failed to fetch');
    });

    const result = await portalCall('/patient/vitals', { method: 'POST', body: {} });

    assert.deepEqual([result.ok, result.status, result.data, result.requestId], [false, 0, null, null]);
    assert.deepEqual(navigations, []);
  });

  it('a 401 signs in again by default, reloads on request, or is just returned', async () => {
    browser(() => Response.json({ message: 'Unauthenticated.' }, { status: 401 }));

    assert.equal((await portalCall('/patient/claim-links', { method: 'POST', body: {} })).status, 401);
    assert.equal((await portalCall('/patient/claim', { method: 'POST', body: {}, onUnauthenticated: 'reload' })).status, 401);
    const none = await portalCall('/patient/vitals', { method: 'POST', body: {}, onUnauthenticated: 'none' });

    assert.deepEqual(navigations, ['/login', 'reload']);
    assert.equal(none.message, 'Unauthenticated.');
  });

  it('a signed-in 403 two_factor_setup_required goes to setup; other 403s do not', async () => {
    browser((url) =>
      url.endsWith('/goals')
        ? Response.json({ message: 'Set up two-step.', code: 'two_factor_setup_required' }, { status: 403 })
        : Response.json({ message: 'Off.', code: 'module_off' }, { status: 403 })
    );

    const result = await portalCall('/patient/vitals/goals', { method: 'POST', body: {} });
    await portalCall('/patient/vitals', { method: 'POST', body: {} });

    assert.equal(result.code, 'two_factor_setup_required');
    assert.deepEqual(navigations, [TWO_FACTOR_SETUP_PATH]);
  });

  it('an anonymous call never navigates: a 401 there is "did not match"', async () => {
    browser(() => Response.json({ message: 'Those details did not match.', request_id: null }, { status: 401 }));

    const result = await apiCall('/api/session', { method: 'POST', body: { email: 'a@example.test' }, signedIn: false });

    assert.deepEqual(navigations, []);
    assert.equal(result.message, 'Those details did not match.');
  });

  it('carries the Reference, the wait on a 429, the raw body and the referrer policy', async () => {
    browser(() => Response.json({ message: 'Too many tries.', request_id: 'req-1', retry_after: 12, field: 'token' }, { status: 429 }));

    const result = await apiCall('/api/account/reset', { method: 'POST', body: {}, referrerPolicy: 'no-referrer', signedIn: false });

    assert.equal(calls[0].init.referrerPolicy, 'no-referrer');
    assert.deepEqual([result.requestId, result.retryAfter, result.payload.field], ['req-1', 12, 'token']);
  });

  it('fieldErrors keeps the first message per field', () => {
    assert.deepEqual(fieldErrors({ a: ['one', 'two'], b: 'three' }), { a: 'one', b: 'three' });
    assert.deepEqual(fieldErrors(null), {});
  });
});

describe('screen guard (P-08)', () => {
  it('sends a required-two-step session to setup', () => {
    assert.throws(() => guard({ status: 403, code: 'two_factor_setup_required' }), (error) => error.url === TWO_FACTOR_SETUP_PATH);
  });

  it('reports a 401 and lets everything else through', () => {
    assert.equal(guard({ status: 401 }), true);
    assert.equal(guard({ status: 403, code: 'module_off' }), false);
    assert.equal(guard({ status: 0 }), false);
    assert.equal(guard({ status: 200, ok: true }), false);
  });

  it('lands a new session on setup when the install requires it', () => {
    assert.equal(landingFor({ two_factor: { enabled: false, setup_required: true } }), TWO_FACTOR_SETUP_PATH);
    assert.equal(landingFor({ two_factor: { enabled: true, setup_required: false } }), '/');
    assert.equal(landingFor(null), '/');
  });
});

describe('ids (P-08)', () => {
  it('accepts an admin uuid and nothing that could change the path', () => {
    assert.ok(isUuid('0b6f1c2e-6a0b-4c1e-9f3a-2d4e5f6a7b8c'));
    assert.ok(isUuid('0B6F1C2E-6A0B-4C1E-9F3A-2D4E5F6A7B8C'));
    for (const bad of ['', '..', '0b6f1c2e-6a0b-4c1e-9f3a-2d4e5f6a7b8', '0b6f1c2e-6a0b-4c1e-9f3a-2d4e5f6a7b8c/..', '../../../../../../../../../../patient', null, 42]) {
      assert.ok(!isUuid(bad), String(bad));
    }
    assert.equal(UUID_PATTERN, '[0-9a-fA-F-]{36}');
  });
});

describe('startup env check (P-14)', () => {
  const GOOD = {
    ADMIN_API_BASE_URL: 'https://admin.example.test/api/v1',
    SESSION_SECRET: 'x'.repeat(MIN_SECRET_BYTES),
    PORTAL_URL: 'https://portal.example.test',
  };

  it('accepts a complete environment', () => {
    assert.deepEqual(envProblems(GOOD), []);
    assert.doesNotThrow(() => assertEnv(GOOD));
    assert.deepEqual(envProblems({ ...GOOD, ADMIN_API_BASE_URL: 'http://localhost:8000/api/v1/' }), []);
  });

  it('names every missing variable at once', () => {
    const problems = envProblems({});

    assert.equal(problems.length, 3);
    assert.match(problems.join(' '), /ADMIN_API_BASE_URL/);
    assert.match(problems.join(' '), /SESSION_SECRET/);
    assert.match(problems.join(' '), /PORTAL_URL/);
    assert.throws(() => assertEnv({}), /will not start/);
  });

  it('requires the base URL to be http(s) and end in /api/v1', () => {
    for (const value of ['https://admin.example.test', 'https://shop.example.test/api', 'https://admin.example.test/api/v2', 'ftp://admin.example.test/api/v1', 'admin.example.test/api/v1']) {
      assert.equal(envProblems({ ...GOOD, ADMIN_API_BASE_URL: value }).length, 1, value);
    }
  });

  it('requires a session secret of at least 32 bytes, and never echoes it', () => {
    const problems = envProblems({ ...GOOD, SESSION_SECRET: 'short-but-secret' });

    assert.equal(problems.length, 1);
    assert.match(problems[0], /32 bytes/);
    assert.doesNotMatch(problems[0], /short-but-secret/);
  });

  it('uses the request guard\'s rule for PORTAL_URL', () => {
    assert.match(envProblems({ ...GOOD, PORTAL_URL: 'not a url' })[0], /PORTAL_URL is not a valid URL/);
  });
});
