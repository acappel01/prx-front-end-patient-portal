import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ERROR_MESSAGE, UNCERTAIN_MESSAGE, approvalOutcome } from '../lib/approvalOutcome.js';

// portalCall()'s shape.
const answer = (fields) => ({ ok: false, status: 0, data: null, message: null, errors: null, code: null, requestId: null, ...fields });

describe('approvalOutcome', () => {
  it('charged and declined are done, no retry', () => {
    for (const outcome of ['charged', 'declined']) {
      const result = approvalOutcome(answer({ ok: true, status: 200, data: { outcome, message: 'Done.' } }));

      assert.deepEqual([result.outcome, result.retry, result.uncertain, result.message], [outcome, false, false, 'Done.']);
    }
  });

  it('retries with a new key only on code "error"', () => {
    const result = approvalOutcome(answer({ status: 502, code: 'error', message: 'Nothing was charged. Please try again.', requestId: 'req-1' }));

    assert.deepEqual([result.outcome, result.retry, result.uncertain, result.reference], ['error', true, false, 'req-1']);
    assert.equal(approvalOutcome(answer({ status: 502, code: 'error' })).message, ERROR_MESSAGE);
  });

  it('definite refusals settle without a retry', () => {
    for (const code of ['payment_required', 'gateway_declined', 'price_mismatch', 'already_resolved']) {
      const result = approvalOutcome(answer({ status: code.startsWith('p') && code !== 'price_mismatch' ? 402 : 409, code, message: 'Why.' }));

      assert.deepEqual([result.outcome, result.retry, result.uncertain, result.message], [code, false, false, 'Why.'], code);
    }
  });

  it('the admin\'s 202 uncertain keeps its sentence and offers no retry', () => {
    const result = approvalOutcome(answer({ ok: true, status: 202, data: { outcome: 'uncertain', message: 'Admin says wait.' } }));

    assert.deepEqual([result.outcome, result.retry, result.uncertain, result.message], ['uncertain', false, true, 'Admin says wait.']);
  });

  const unclear = {
    'a dropped connection': answer({ status: 0 }),
    'the proxy\'s upstream_unreachable': answer({ status: 504, code: 'upstream_unreachable', message: 'We could not reach the service.' }),
    'a bare 502 from the web server': answer({ status: 502 }),
    'a bare 504 from the web server': answer({ status: 504 }),
    'a bodiless 500': answer({ status: 500 }),
    'an unknown code': answer({ status: 409, code: 'something_new', message: 'New.' }),
    'a 2xx with an unknown outcome': answer({ ok: true, status: 200, data: { outcome: 'queued' } }),
    'a 2xx with no outcome': answer({ ok: true, status: 200, data: null }),
  };

  for (const [name, response] of Object.entries(unclear)) {
    it(`${name} is uncertain: no retry, our copy`, () => {
      const result = approvalOutcome(response, 'accept');

      assert.deepEqual([result.outcome, result.retry, result.uncertain, result.message], ['uncertain', false, true, UNCERTAIN_MESSAGE.accept]);
    });
  }

  it('an unclear decline gets the decline copy', () => {
    assert.equal(approvalOutcome(answer({ status: 504 }), 'decline').message, UNCERTAIN_MESSAGE.decline);
  });

  it('shows the reference on an uncertain answer', () => {
    assert.equal(approvalOutcome(answer({ status: 502, requestId: 'req-2' })).reference, 'req-2');
  });
});
