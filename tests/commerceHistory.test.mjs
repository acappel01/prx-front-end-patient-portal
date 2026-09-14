import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, historyPage, isOrderUuid, loadOrderDetail, loadOrderHistory, responseState, safeTrackingUrl } from '../lib/commerceHistory.mjs';

const UUID = '11111111-2222-4333-8444-555555555555';
const history = (overrides = {}) => ({ ok: true, status: 200, data: [{ uuid: UUID }],
  meta: { total: 41, current_page: 1, last_page: 3 }, ...overrides });

test('only bounded single page values and canonical UUID paths are accepted', async () => {
  assert.equal(historyPage(undefined), 1);
  assert.equal(historyPage('10000'), 10000);
  for (const value of [0, '0', '-1', '10001', '1.2', '', ' 1', ['1'], '1&customer_id=9']) assert.equal(historyPage(value), null);
  assert.equal(isOrderUuid(UUID), true);
  for (const value of ['../patient/orders', UUID + '?customer_id=9', 'x'.repeat(36), null]) assert.equal(isOrderUuid(value), false);
  const fail = () => assert.fail('Invalid route input must not fetch');
  assert.equal((await loadOrderHistory(fail, null)).state, 'invalid');
  assert.equal((await loadOrderDetail(fail, '../patient/orders')).state, 'not-found');
});

test('history uses only local commerce with fixed pagination and reconstructs local links', async () => {
  const calls = [];
  const result = await loadOrderHistory(async (path) => {
    calls.push(path);
    return history({ links: { next: 'https://untrusted.test/redirect?token=private' } });
  }, 1);
  assert.deepEqual(calls, ['/orders?page=1&per_page=20']);
  assert.equal(result.next, '/record/purchases?page=2');
  assert.equal(result.previous, null);
  const second = await loadOrderHistory(async () => history({ meta: { total: 41, current_page: 2, last_page: 3 } }), 2);
  assert.equal(second.previous, '/record/purchases');
  assert.equal(second.next, '/record/purchases?page=3');
});

test('empty history needs a successful valid envelope; errors and malformed responses are not emptiness', async () => {
  const empty = await loadOrderHistory(async () => history({ data: [], meta: { total: 0, current_page: 1, last_page: 1 } }), 1);
  assert.equal(empty.state, 'ready');
  assert.deepEqual(empty.data, []);
  assert.equal(empty.next, null);
  for (const response of [history({ data: null }), history({ data: [{}] }), history({ data: [{ uuid: UUID, placed_at: {} }] }), history({ meta: null }),
    history({ meta: { total: -1, current_page: 1, last_page: 1 } }), history({ meta: { total: 1, current_page: 2, last_page: 1 } })]) {
    assert.equal((await loadOrderHistory(async () => response, 1)).state, 'unavailable');
  }
  assert.equal((await loadOrderHistory(async () => { throw new Error('private error'); }, 1)).state, 'unavailable');
});

test('auth, two-factor, inaccessible orders and rate limits retain separate states', async () => {
  for (const [status, code, expected] of [[401, null, 'signed-out'], [403, null, 'forbidden'],
    [403, 'two_factor_setup_required', 'two-factor'], [404, null, 'not-found'], [422, null, 'invalid'],
    [429, null, 'limited'], [503, null, 'unavailable'], [409, 'no_linked_chart', 'unavailable']]) {
    const response = { ok: false, status, code, data: null };
    assert.equal(responseState(response), expected);
    assert.equal((await loadOrderHistory(async () => response, 1)).state, expected);
    assert.equal((await loadOrderDetail(async () => response, UUID)).state, expected);
  }
});

test('details never request a provider path and fail closed for the wrong order or malformed lists', async () => {
  const detail = { uuid: UUID, items: [], shipments: [] };
  const calls = [];
  assert.equal((await loadOrderDetail(async (path) => { calls.push(path); return history({ data: detail }); }, UUID)).state, 'ready');
  assert.deepEqual(calls, [`/orders/${UUID}`]);
  for (const data of [null, {}, { ...detail, uuid: 'another-order' }, { ...detail, items: null }, { ...detail, shipments: {} }, { ...detail, uuid: 123 }, { ...detail, items: [null] }, { ...detail, shipments: [{ carrier: {} }] }]) {
    assert.equal((await loadOrderDetail(async () => history({ data }), UUID)).state, 'unavailable');
  }
});

test('currency is retained and missing amounts do not become zero or a dollar default', () => {
  assert.match(formatMoney('123.45', 'CAD'), /CAD.*123\.45/);
  assert.match(formatMoney(0, 'USD'), /USD.*0\.00/);
  for (const [amount, currency] of [[null, 'USD'], ['', 'USD'], ['unknown', 'USD'], ['  ', 'USD'], ['4.00', null], ['4.00', '<script>']]) {
    assert.equal(formatMoney(amount, currency), 'Not recorded');
  }
});

test('tracking links allow only HTTPS without credentials or control characters', () => {
  assert.equal(safeTrackingUrl('https://carrier.example.test/track?id=123'), 'https://carrier.example.test/track?id=123');
  for (const value of ['javascript:alert(1)', 'http://carrier.test', '//carrier.test', 'https://name:secret@carrier.test', 'https://carrier.test/\nprivate', null]) {
    assert.equal(safeTrackingUrl(value), null);
  }
});
