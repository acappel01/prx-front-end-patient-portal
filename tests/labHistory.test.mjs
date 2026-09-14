import assert from 'node:assert/strict';
import test from 'node:test';
import { labLabel, labPage, labsEnabled, loadLabHistory } from '../lib/labHistory.mjs';

const row = { id: 'lab-fixture', lab_order_number: 'LAB-ONE', status: 'pending_review', collection_method: 'walk_in_draw',
  ordered_at: '2026-09-14T01:00:00Z', results_received_at: null, completed_at: null, created_at: '2026-09-13T01:00:00+00:00' };
const response = (page = 1) => ({ ok: true, status: 200, data: { items: [{ ...row }], pagination: { current_page: page, per_page: 20, last_page: 2, total: 21 } } });

test('labs use only bounded patient requests and construct local pagination', async () => {
  const calls = [];
  const result = await loadLabHistory(async (path) => { calls.push(path); return response(); }, labPage(undefined));
  assert.deepEqual(calls, ['/patient/labs?page=1&per_page=20']);
  assert.equal(result.next, '/health/labs?page=2');
  assert.equal(result.previous, null);
  const second = await loadLabHistory(async () => response(2), 2);
  assert.equal(second.previous, '/health/labs');
  assert.equal(second.next, null);
  for (const value of ['0', '-1', '1.5', '10001', ['1'], '1&chart=other']) {
    assert.equal(labPage(value), null);
    assert.equal((await loadLabHistory(() => { throw new Error('must not request'); }, labPage(value))).state, 'invalid');
  }
});

test('labs whitelist status history and reject malformed or naive timestamp data', async () => {
  const source = response();
  Object.assign(source.data.items[0], { billing_type: 'PRIVATE', results: [{ value: 'PRIVATE' }], patient_chart_id: 'PRIVATE', checkout_url: 'https://private.invalid' });
  const result = await loadLabHistory(async () => source, 1);
  assert.deepEqual(result.items, [row]);
  for (const change of [
    (r) => { r.data.items = null; },
    (r) => { r.data.items[0].status = {}; },
    (r) => { r.data.items[0].ordered_at = '2026-09-14 01:00:00'; },
    (r) => { r.data.items[0].completed_at = 'not-a-date'; },
    (r) => { r.data.pagination.current_page = 2; },
    (r) => { r.data.pagination.per_page = 100; },
    (r) => { r.data.pagination.total = -1; },
    (r) => { r.data.pagination.last_page = 0; },
    (r) => { r.data.items = Array(21).fill(row); },
  ]) {
    const malformed = response(); change(malformed);
    assert.equal((await loadLabHistory(async () => malformed, 1)).state, 'unavailable');
  }
});

test('labs keep empty, missing chart, session, two-factor, ability, throttling and upstream failures distinct', async () => {
  const empty = response(); empty.data.items = []; empty.data.pagination = { current_page: 1, per_page: 20, last_page: 1, total: 0 };
  assert.equal((await loadLabHistory(async () => empty, 1)).state, 'ready');
  for (const [status, code, state] of [[409, 'no_linked_chart', 'unlinked'], [409, null, 'unavailable'],
    [401, null, 'signed-out'], [403, null, 'forbidden'], [403, 'two_factor_setup_required', 'two-factor'],
    [422, null, 'invalid'], [429, null, 'limited'], [502, null, 'unavailable']]) {
    const result = await loadLabHistory(async () => ({ ok: false, status, code, message: 'PRIVATE_PROVIDER_ERROR' }), 1);
    assert.equal(result.state, state);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_PROVIDER_ERROR'));
  }
  assert.equal((await loadLabHistory(async () => { throw new Error('PRIVATE'); }, 1)).state, 'unavailable');
});

test('unknown status is humanized without clinical interpretation and module false is honored', () => {
  assert.equal(labLabel('awaiting_external_review'), 'Awaiting external review');
  assert.equal(labLabel('new-provider-state'), 'New provider state');
  assert.equal(labLabel(null, 'Status unavailable'), 'Status unavailable');
  assert.equal(labsEnabled({ portal: { modules: { labs: false } } }), false);
  assert.equal(labsEnabled({ portal: { modules: {} } }), true);
});
