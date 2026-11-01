import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_POLL_FAILURES, MAX_POLL_MS, POLL_MS, afterPoll, pollDelay } from '../lib/exportPoll.js';
import { rateLimitReply, retryAfterSeconds, tooManyMessage } from '../lib/rateLimit.js';
import { WARN_BEFORE_MS, deadlinesFrom, sessionPhase } from '../lib/sessionClock.js';
import { NO_MATCH, TOO_MANY, UNAVAILABLE, UNREACHABLE, signInRefusal } from '../lib/signInRefusal.js';

// adminFetch()/portalCall()'s shape.
const answer = (fields) => ({ ok: false, status: 0, data: null, message: null, errors: null, code: null, requestId: null, retryAfter: null, ...fields });

describe('signInRefusal (P-05)', () => {
  it('only a credential refusal is "did not match"', () => {
    for (const status of [422, 401]) {
      assert.deepEqual(signInRefusal(answer({ status })), { status: 401, message: NO_MATCH, requestId: null, log: null }, String(status));
    }
  });

  it('an outage is said as one, with its Reference, and logged without the email', () => {
    for (const status of [500, 502, 503, 404, 403]) {
      const refusal = signInRefusal(answer({ status, requestId: 'req-9' }));

      assert.equal(refusal.status, 503, String(status));
      assert.equal(refusal.message, UNAVAILABLE);
      assert.equal(refusal.requestId, 'req-9');
      assert.match(refusal.log, new RegExp(`HTTP ${status} on /patient/auth/login \\(request req-9\\)`));
    }
  });

  it('a 200 without a session is the admin misbehaving, not a bad password', () => {
    const refusal = signInRefusal(answer({ ok: true, status: 200 }));

    assert.deepEqual([refusal.status, refusal.message], [503, UNAVAILABLE]);
    assert.match(refusal.log, /without a session/);
  });

  it('unreachable and rate-limited keep their own sentences', () => {
    assert.deepEqual([signInRefusal(answer({ status: 0 })).status, signInRefusal(answer({ status: 0 })).message], [503, UNREACHABLE]);
    assert.deepEqual([signInRefusal(answer({ status: 429 })).status, signInRefusal(answer({ status: 429 })).message], [429, TOO_MANY]);
  });
});

describe('rateLimit (P-17)', () => {
  it('reads delta-seconds and HTTP dates, clamped', () => {
    assert.equal(retryAfterSeconds('30'), 30);
    assert.equal(retryAfterSeconds('0'), 1);
    assert.equal(retryAfterSeconds('99999'), 3600);
    assert.equal(retryAfterSeconds(new Date(Date.UTC(2026, 0, 1, 0, 0, 45)).toUTCString(), Date.UTC(2026, 0, 1)), 45);
    assert.equal(retryAfterSeconds(null), null);
    assert.equal(retryAfterSeconds('soon'), null);
  });

  it('says how long to wait', () => {
    assert.equal(tooManyMessage(1), 'Too many tries. Wait 1 second, then try again.');
    assert.equal(tooManyMessage(30), 'Too many tries. Wait 30 seconds, then try again.');
    assert.equal(tooManyMessage(90), 'Too many tries. Wait 2 minutes, then try again.');
    assert.equal(tooManyMessage(null), 'Too many tries. Wait a minute, then try again.');
  });

  it('builds the 429 reply with the header only when there is a wait', () => {
    assert.deepEqual(rateLimitReply(12), { body: { message: tooManyMessage(12), retry_after: 12 }, headers: { 'Retry-After': '12' } });
    assert.deepEqual(rateLimitReply(null), { body: { message: tooManyMessage(null) }, headers: {} });
  });
});

describe('exportPoll (P-11)', () => {
  it('a failed check re-arms with backoff, never sooner than Retry-After', () => {
    assert.equal(pollDelay(0), POLL_MS);
    assert.equal(pollDelay(1), POLL_MS * 2);
    assert.equal(pollDelay(2), POLL_MS * 4);
    assert.equal(pollDelay(10), MAX_POLL_MS);
    assert.equal(pollDelay(1, 30), 30_000);
  });

  it('counts failures as a state change, so the timer re-arms', () => {
    const state = { status: 'queued' };
    const next = afterPoll(state, answer({ status: 503 }));

    assert.notEqual(next, state);
    assert.deepEqual(next, { status: 'queued', failures: 1, retryAfter: null });
    assert.equal(afterPoll(next, answer({ status: 429, retryAfter: 20 })).retryAfter, 20);
  });

  it(`stops after ${MAX_POLL_FAILURES} failures in a row and keeps the Reference`, () => {
    let state = { status: 'queued' };
    for (let i = 0; i < MAX_POLL_FAILURES - 1; i += 1) state = afterPoll(state, answer({ status: 0 }));

    assert.equal(state.status, 'queued');
    assert.deepEqual(afterPoll(state, answer({ status: 502, requestId: 'req-3' })), { status: 'poll_failed', failures: MAX_POLL_FAILURES, reference: 'req-3' });
  });

  it('a good answer resets the count', () => {
    const next = afterPoll({ status: 'queued', failures: 3 }, answer({ ok: true, status: 200, data: { status: 'processing', ready: false } }));

    assert.deepEqual([next.status, next.failures], ['processing', 0]);
    assert.equal(afterPoll({}, answer({ ok: true, status: 200, data: { ready: true } })).status, 'ready');
  });
});

describe('sessionClock (P-16)', () => {
  const t = Date.UTC(2026, 10, 1, 12, 0, 0);
  const iso = (ms) => new Date(ms).toISOString();

  it('measures the admin deadlines against the server clock, not the device', () => {
    // The device is five minutes fast.
    const deadlines = deadlinesFrom({ idle_expires_at: iso(t + 30 * 60_000), expires_at: iso(t + 12 * 3600_000), now: iso(t) }, t + 5 * 60_000);

    assert.deepEqual(deadlines, { idleAt: t + 35 * 60_000, absoluteAt: t + 12 * 3600_000 + 5 * 60_000 });
    assert.equal(deadlinesFrom({}), null);
  });

  it('warns two minutes before the idle limit', () => {
    const deadlines = { idleAt: t + WARN_BEFORE_MS, absoluteAt: t + 3600_000 };

    assert.deepEqual(sessionPhase(deadlines, t - 1), { phase: 'ok', reason: 'idle', remainingMs: WARN_BEFORE_MS + 1 });
    assert.deepEqual(sessionPhase(deadlines, t), { phase: 'warn', reason: 'idle', remainingMs: WARN_BEFORE_MS });
  });

  it('warns before the absolute cap when it comes first', () => {
    const deadlines = { idleAt: t + 30 * 60_000, absoluteAt: t + 60_000 };

    assert.deepEqual(sessionPhase(deadlines, t), { phase: 'warn', reason: 'absolute', remainingMs: 60_000 });
    assert.deepEqual(sessionPhase(deadlines, t + 60_000), { phase: 'ended', reason: 'absolute', remainingMs: 0 });
  });

  it('knows nothing before the first keep-alive', () => {
    assert.equal(sessionPhase(null).phase, 'unknown');
  });
});
