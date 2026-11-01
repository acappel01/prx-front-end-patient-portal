import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { LIMITS, guardRequest, readBody } from '../lib/requestGuard.js';

const ORIGIN = 'https://portal.example.test';

function request({ headers = {}, body } = {}) {
  return new Request(`${ORIGIN}/api/session`, { method: 'POST', headers, ...(body === undefined ? {} : { body, duplex: 'half' }) });
}

async function refusal(response) {
  return { status: response.status, ...(await response.json()) };
}

describe('guardRequest', () => {
  let saved;

  beforeEach(() => {
    saved = process.env.PORTAL_URL;
    process.env.PORTAL_URL = `${ORIGIN}/`;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.PORTAL_URL;
    else process.env.PORTAL_URL = saved;
  });

  it('accepts a same-origin fetch', () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{}' });

    assert.equal(guardRequest(req), null);
  });

  it('accepts a matching Origin when Sec-Fetch-Site is absent', () => {
    const req = request({ headers: { origin: ORIGIN, 'content-type': 'application/json; charset=utf-8' }, body: '{}' });

    assert.equal(guardRequest(req), null);
  });

  it('refuses a sibling subdomain with 403 cross_origin', async () => {
    const req = request({
      headers: { 'sec-fetch-site': 'same-site', origin: 'https://example.test', 'content-type': 'text/plain' },
      body: '{"email":"a@b.c"}',
    });

    assert.deepEqual(await refusal(guardRequest(req)), { status: 403, code: 'cross_origin', message: 'This request did not come from the portal.' });
  });

  it('refuses a request with no Origin and no Sec-Fetch-Site', async () => {
    const req = request({ headers: { 'content-type': 'application/json' }, body: '{}' });

    assert.equal((await refusal(guardRequest(req))).code, 'cross_origin');
  });

  it('refuses an Origin of "null"', async () => {
    const req = request({ headers: { origin: 'null', 'content-type': 'application/json' }, body: '{}' });

    assert.equal(guardRequest(req).status, 403);
  });

  it('origin-checks a bodiless handler too', async () => {
    assert.equal(guardRequest(request(), { kind: 'none' }).status, 403);
    assert.equal(guardRequest(request({ headers: { 'sec-fetch-site': 'same-origin' } }), { kind: 'none' }), null);
  });

  it('refuses text/plain and form posts on a JSON route with 415', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': type }, body: '{}' });

      assert.equal((await refusal(guardRequest(req))).status, 415, type);
    }
  });

  it('accepts a bodiless POST without a Content-Type', () => {
    assert.equal(guardRequest(request({ headers: { 'sec-fetch-site': 'same-origin' } })), null);
  });

  it('refuses a body with no Content-Type', () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-length': '2' } });

    assert.equal(guardRequest(req).status, 415);
  });

  it('refuses a declared Content-Length over the cap with 413, before reading', async () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'content-length': String(LIMITS.json + 1) } });

    assert.deepEqual(await refusal(guardRequest(req)), { status: 413, code: 'too_large', message: 'That request is too large.' });
    assert.equal(guardRequest(req, { maxBytes: LIMITS.proxy }), null);
  });

  it('uses a route-specific message for 413', async () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'multipart/form-data; boundary=x', 'content-length': '11' } });

    assert.equal((await refusal(guardRequest(req, { kind: 'multipart', maxBytes: 10, tooLargeMessage: 'Too big.' }))).message, 'Too big.');
  });

  it('requires multipart on a multipart route', () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{}' });

    assert.equal(guardRequest(req, { kind: 'multipart', maxBytes: 1024 }).status, 415);
  });

  it('fails closed with 500 misconfigured when PORTAL_URL is unset or invalid', async () => {
    const req = request({ headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }, body: '{}' });
    const log = console.error;
    console.error = () => {};

    try {
      delete process.env.PORTAL_URL;
      assert.deepEqual(
        { status: guardRequest(req).status, code: (await guardRequest(req).json()).code },
        { status: 500, code: 'misconfigured' }
      );

      process.env.PORTAL_URL = 'not a url';
      assert.equal(guardRequest(req).status, 500);
    } finally {
      console.error = log;
    }
  });
});

describe('readBody', () => {
  it('parses JSON under the cap', async () => {
    const req = request({ headers: { 'content-type': 'application/json' }, body: '{"code":"123456"}' });

    assert.deepEqual(await readBody(req), { body: { code: '123456' } });
  });

  it('gives null for an empty or malformed JSON body', async () => {
    assert.deepEqual(await readBody(request()), { body: null });
    assert.deepEqual(await readBody(request({ headers: { 'content-type': 'application/json' }, body: '{' })), { body: null });
  });

  it('refuses a streamed body that passes the cap without a declared length', async () => {
    const big = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(LIMITS.json));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    const req = request({ headers: { 'content-type': 'application/json' }, body: big });

    assert.equal(req.headers.get('content-length'), null);
    assert.equal((await readBody(req)).response.status, 413);
  });

  it('refuses a body whose type is not JSON', async () => {
    const req = request({ body: new Blob(['{}']) });

    assert.equal((await readBody(req)).response.status, 415);
  });

  it('returns raw bytes for multipart', async () => {
    const req = request({ headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: 'abc' });
    const { body } = await readBody(req, { kind: 'multipart', maxBytes: 10 });

    assert.equal(body.byteLength, 3);
  });
});
