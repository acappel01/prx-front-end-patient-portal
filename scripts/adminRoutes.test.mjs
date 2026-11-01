import assert from 'node:assert/strict';
import { register } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';

// Route handlers and lib/adminApi.js, run against a stubbed admin: `fetch` is
// replaced per test, and Next's cookies/headers/after are the stubs in
// scripts/support (resolved by its hooks, registered before anything imports).
register('./support/hooks.mjs', import.meta.url);

process.env.ADMIN_API_BASE_URL = 'https://admin.example.test/api/v1';
process.env.PORTAL_URL = 'https://portal.example.test';
process.env.SESSION_SECRET = 'test-only-signing-key-not-a-real-secret-000';

const state = (globalThis.__test ??= { cookies: new Map(), headers: {}, after: [] });
const { adminFetch } = await import('../lib/adminApi.js');
const { sessionToken, startSession } = await import('../lib/session.js');
const sessionRoute = await import('../app/api/session/route.js');
const proxyRoute = await import('../app/api/portal/[...path]/route.js');
const { NO_MATCH, UNAVAILABLE } = await import('../lib/signInRefusal.js');

const realFetch = globalThis.fetch;
const realError = console.error;
let calls;
let logged;

function admin(handler) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    return handler(String(url), init);
  };
}

const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });

function post(path, body, extraHeaders = {}) {
  return new Request(`https://portal.example.test${path}`, {
    method: 'POST',
    headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function runAfter() {
  const queued = state.after.splice(0);
  for (const callback of queued) await callback();
}

beforeEach(() => {
  calls = [];
  logged = [];
  state.cookies.clear();
  state.after.length = 0;
  console.error = (line) => logged.push(String(line));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

describe('adminFetch never throws (P-04)', () => {
  it('a refused connection is status 0, logged with the path but not the query', async () => {
    admin(() => {
      throw new TypeError('fetch failed');
    });

    const result = await adminFetch('/patient/health-record/allergies/search?q=penicillin', { token: 't' });

    assert.deepEqual([result.ok, result.status, result.data], [false, 0, null]);
    assert.equal(logged.length, 1);
    assert.match(logged[0], /GET \/patient\/health-record\/allergies\/search \(TypeError\)/);
    assert.doesNotMatch(logged[0], /penicillin/);
  });

  it('every call carries a time limit, and a timeout is status 0', async () => {
    admin((url, init) => {
      assert.ok(init.signal instanceof AbortSignal);
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });

    const result = await adminFetch('/patient/home', { token: 't' });

    assert.equal(result.status, 0);
    assert.match(logged[0], /TimeoutError/);
  });

  it('reads Retry-After on a 429', async () => {
    admin(() => json({ message: 'Too many requests. Please wait a moment.' }, 429, { 'Retry-After': '42' }));

    assert.equal((await adminFetch('/patient/home', { token: 't' })).retryAfter, 42);
  });
});

describe('sign-in (P-05, P-22)', () => {
  const login = () => sessionRoute.POST(post('/api/session', { email: 'pat@example.test', password: 'pw' }));

  it('a 422 from the admin is "did not match"', async () => {
    admin(() => json({ message: 'The given data was invalid.', errors: { email: ['These credentials do not match our records.'] } }, 422));

    const response = await login();

    assert.equal(response.status, 401);
    assert.equal((await response.json()).message, NO_MATCH);
  });

  for (const status of [500, 503, 404]) {
    it(`an admin ${status} is "couldn't sign you in right now", with the Reference, logged without the email`, async () => {
      admin(() => json({ message: 'Server Error' }, status, { 'X-Request-ID': 'req-77' }));

      const response = await login();
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.deepEqual(body, { message: UNAVAILABLE, request_id: 'req-77' });
      assert.equal(logged.length, 1);
      assert.match(logged[0], new RegExp(`HTTP ${status}`));
      assert.doesNotMatch(logged.join('\n'), /pat@example\.test|pw/);
    });
  }

  it('an unreachable admin is 503, not a thrown 500', async () => {
    admin(() => {
      throw new TypeError('fetch failed');
    });

    assert.equal((await login()).status, 503);
  });

  it('signing in over an existing session revokes the old token upstream', async () => {
    await startSession('old-token');
    admin((url) => (url.endsWith('/patient/auth/login') ? json({ data: { token: 'new-token', patient: {} } }) : json({ data: { message: 'Token revoked.' } })));

    const response = await login();

    assert.equal(response.status, 200);
    assert.equal(await sessionToken(), 'new-token');
    assert.equal(calls.length, 1, 'revocation waits until after the response');

    await runAfter();

    assert.equal(calls.length, 2);
    assert.match(calls[1].url, /\/patient\/auth\/logout$/);
    assert.equal(calls[1].init.method, 'POST');
    assert.equal(calls[1].init.headers.Authorization, 'Bearer old-token');
  });

  it('a two-step sign-in over an existing session revokes it too', async () => {
    await startSession('old-token');
    admin((url) => (url.endsWith('/patient/auth/login') ? json({ data: { two_factor_required: true, challenge: 'c' } }) : json({ data: {} })));

    await login();
    await runAfter();

    assert.equal(await sessionToken(), null);
    assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer old-token');
  });

  it('a failed sign-in leaves the existing session alone', async () => {
    await startSession('old-token');
    admin(() => json({ message: 'invalid' }, 422));

    await login();
    await runAfter();

    assert.equal(await sessionToken(), 'old-token');
    assert.equal(calls.length, 1);
  });

  it('a first sign-in revokes nothing', async () => {
    admin(() => json({ data: { token: 'new-token', patient: {} } }));

    await login();
    await runAfter();

    assert.equal(calls.length, 1);
  });
});

describe('keep-alive (P-16)', () => {
  it('returns both deadlines and the server clock', async () => {
    await startSession('tok');
    admin(() => json({ data: { idle_minutes: 30, idle_expires_at: '2026-11-01T12:30:00+00:00', expires_at: '2026-11-02T00:00:00+00:00' } }));

    const body = await (await sessionRoute.GET()).json();

    assert.equal(body.data.idle_expires_at, '2026-11-01T12:30:00+00:00');
    assert.equal(body.data.expires_at, '2026-11-02T00:00:00+00:00');
    assert.ok(Number.isFinite(Date.parse(body.data.now)));
  });

  it('an unreachable admin is 503, never status 0', async () => {
    await startSession('tok');
    admin(() => {
      throw new TypeError('fetch failed');
    });

    assert.equal((await sessionRoute.GET()).status, 503);
  });
});

describe('portal proxy (P-04, P-17)', () => {
  const context = (path) => ({ params: Promise.resolve({ path }) });

  it('forwards Retry-After on a 429 with the shared message', async () => {
    await startSession('tok');
    admin(() => json({ message: 'Too many requests. Please wait a moment.' }, 429, { 'Retry-After': '30' }));

    const response = await proxyRoute.POST(post('/api/portal/patient/communication-preferences', { email: false }), context(['patient', 'communication-preferences']));
    const body = await response.json();

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '30');
    assert.deepEqual([body.message, body.retry_after], ['Too many tries. Wait 30 seconds, then try again.', 30]);
  });

  it('an unreachable admin on a write is 504 upstream_unreachable', async () => {
    await startSession('tok');
    admin(() => {
      throw new DOMException('timeout', 'TimeoutError');
    });

    const response = await proxyRoute.POST(post('/api/portal/patient/vitals', { weight: 180 }), context(['patient', 'vitals']));

    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, 'upstream_unreachable');
  });

  it('passes a plain Idempotency-Key on and no other browser header', async () => {
    await startSession('tok');
    admin(() => json({ data: { id: 1 } }, 201));

    await proxyRoute.POST(
      post('/api/portal/patient/vitals', { weight_lbs: 180 }, { 'idempotency-key': 'a1b2c3d4-0000-4000-8000-000000000001', 'x-forwarded-host': 'evil.test' }),
      context(['patient', 'vitals'])
    );

    const sent = calls.at(-1).init.headers;
    assert.equal(sent['Idempotency-Key'], 'a1b2c3d4-0000-4000-8000-000000000001');
    assert.equal(sent['x-forwarded-host'], undefined);
  });

  it('drops an Idempotency-Key that is not a plain token', async () => {
    await startSession('tok');
    admin(() => json({ data: { id: 1 } }, 201));

    await proxyRoute.POST(post('/api/portal/patient/vitals', { weight_lbs: 180 }, { 'idempotency-key': 'short' }), context(['patient', 'vitals']));

    assert.equal(calls.at(-1).init.headers['Idempotency-Key'], undefined);
  });
});
