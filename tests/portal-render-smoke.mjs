import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const guard = fileURLToPath(new URL('./fixtures/loopback-only.cjs', import.meta.url));
const uuid = '11111111-2222-4333-8444-555555555555';
const token = 'fixture-only-patient-bearer-NEVER-REAL';
const secret = 'fixture-only-session-secret-for-isolated-render-smoke';
const cookie = `prx_session=${token}.${createHmac('sha256', secret).update(token).digest('base64url')}`;
let mode = 'list';
const calls = [];
const summary = { uuid, status: 'pending', total_amount: '149.50', currency: 'CAD',
  placed_at: '2026-09-14T10:00:00.000000Z', shipped_at: null, delivered_at: null, cancelled_at: null, items_count: 1,
  private_fixture: 'PRIVATE_FIXTURE_NEVER_RENDER', customer_id: 987 };
const detail = { ...summary, subtotal: '149.50', tax_amount: '0.00', shipping_amount: '0.00', discount_amount: '0.00',
  prescribe_rx_order_number: 'ORDER-EXAMPLE',
  items: [{ id: 1, name: 'Fixture item', quantity: 1, unit_price: '149.50', line_total: '149.50', billing_period: null }],
  shipments: [{ id: 1, status: 'in_transit', carrier: 'Fixture carrier', tracking_number: 'TRACK-EXAMPLE',
    tracking_url: 'javascript:alert(1)', shipped_at: '2026-09-14T11:00:00Z', delivered_at: null }],
  metadata: { clinical: 'PRIVATE_FIXTURE_NEVER_RENDER' }, shipping_address: 'PRIVATE_FIXTURE_NEVER_RENDER' };
const admin = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  calls.push({ path: url.pathname, search: url.search, auth: req.headers.authorization });
  const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/v1/config') return json(200, { data: { brand: { name: 'Fixture portal' }, portal: { modules: {}, session: {} } } });
  if (url.pathname === '/api/v1/patient/health/series') {
    const dates = mode === 'single' ? ['2026-09-14T01:00:00Z'] : ['2026-01-01T01:00:00Z', '2026-09-14T01:00:00Z'];
    return json(200, { data: { period: '1year', goal: { weight: 185 },
      series: { weight: dates.map((at) => ({ at, value: 185 })),
        blood_pressure: dates.map((at) => ({ at, systolic: 120, diastolic: 80 })) },
      items: dates.map((created_at, id) => ({ id, created_at, weight: 185, systolic_bp: 120, diastolic_bp: 80 })) } });
  }
  if (url.pathname.startsWith('/api/v1/orders')) {
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1200));
    if (req.headers.authorization !== `Bearer ${token}`) return json(401, { message: 'Unauthenticated.' });
    if (mode === 'wrong-account') return json(404, { message: 'PRIVATE_FIXTURE_NEVER_RENDER' });
    if (mode === 'two-factor') return json(403, { code: 'two_factor_setup_required' });
    if (mode === 'expired') return json(401, { message: 'PRIVATE_FIXTURE_NEVER_RENDER' });
    if (mode === 'unavailable') return json(503, { message: 'PRIVATE_FIXTURE_NEVER_RENDER' });
    if (mode === 'disconnect') return req.socket.destroy();
    if (url.pathname.endsWith(uuid)) return json(200, { data: detail });
    const page = Number(url.searchParams.get('page') || 1);
    return json(200, { data: mode === 'empty' ? [] : [summary],
      meta: { total: mode === 'empty' ? 0 : 21, per_page: 20, current_page: page, last_page: mode === 'empty' ? 1 : 2 },
      links: { next: 'https://forbidden-admin-host.invalid/?private=PRIVATE_FIXTURE_NEVER_RENDER' } });
  }
  if (url.pathname === '/api/v1/patient/orders') {
    if (mode === 'clinical-disconnect') return req.socket.destroy();
    return json(409, { code: 'no_linked_chart' });
  }
  if (url.pathname === '/api/v1/patient/profile') return json(409, { code: 'no_linked_chart' });
  if (url.pathname === '/api/v1/patient/security/events') return json(200, { data: [] });
  if (url.pathname === '/api/v1/patient/two-factor') return json(200, { data: { enabled: false, policy: 'optional' } });
  return json(404, { message: 'Fixture unknown path' });
});
admin.listen(0, '127.0.0.1');
await once(admin, 'listening');
const adminPort = admin.address().port;
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const portalPort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
process.env.FIXTURE_ALLOWED_PORTS = `${adminPort},${portalPort}`;
createRequire(import.meta.url)(guard);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(portalPort)], {
  cwd: workspace, env: { PATH: process.env.PATH, HOME: '/tmp', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    ADMIN_API_BASE_URL: `http://127.0.0.1:${adminPort}/api/v1`, SESSION_SECRET: secret,
    FIXTURE_ALLOWED_PORTS: process.env.FIXTURE_ALLOWED_PORTS,
    NODE_OPTIONS: `--require=${guard}` }, stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (chunk) => { log += chunk; });
child.stderr.on('data', (chunk) => { log += chunk; });
const base = `http://127.0.0.1:${portalPort}`;
async function request(path, authenticated = true) {
  const response = await fetch(base + path, { redirect: 'manual', headers: authenticated ? { Cookie: cookie } : {} });
  const html = await response.text();
  for (const forbidden of [token, secret, `127.0.0.1:${adminPort}`, 'forbidden-admin-host.invalid', 'PRIVATE_FIXTURE_NEVER_RENDER']) {
    assert.ok(!html.includes(forbidden), `HTML leaked ${forbidden}`);
  }
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
  return { response, html };
}
try {
  const deadline = Date.now() + 20000;
  while (!log.includes('Ready in')) {
    if (child.exitCode !== null) throw new Error(`Next exited: ${log}`);
    if (Date.now() > deadline) throw new Error(`Next startup timeout: ${log}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  let before = calls.length;
  let result = await request('/record/purchases', false);
  assert.equal(result.response.status, 307);
  assert.equal(result.response.headers.get('location'), '/login');
  assert.ok(!calls.slice(before).some((call) => call.path.includes('/orders')));
  console.log('PASS anonymous redirect; no commerce/admin authenticated fetch');

  result = await request('/record/purchases?customer_id=987&per_page=100');
  assert.equal(result.response.status, 200);
  assert.match(result.html, /Orders from this site/);
  assert.match(result.html, /149\.50/);
  assert.match(result.html, /CAD/);
  assert.match(result.html, /\/record\/purchases\?page=2/);
  assert.match(result.html, /clinical order history/);
  assert.match(result.html, /do not confirm/);
  assert.ok(calls.some((call) => call.search === '?page=1&per_page=20' && call.auth === `Bearer ${token}`));
  result = await request('/record/purchases?page=2');
  assert.match(result.html, /Previous page/);
  assert.doesNotMatch(result.html, />Next page</);
  console.log('PASS list/detail coverage, recorded currency and fixed local pagination');

  result = await request(`/record/purchases/${uuid}`);
  assert.equal(result.response.status, 200);
  assert.match(result.html, /Fixture item/);
  assert.match(result.html, /Fixture carrier/);
  assert.match(result.html, /TRACK-EXAMPLE/);
  assert.doesNotMatch(result.html, /javascript:alert/);
  console.log('PASS detail items/shipments; private fields and unsafe tracking omitted');

  mode = 'wrong-account';
  result = await request(`/record/purchases/${uuid}`);
  assert.match(result.html, /not available for your account/);
  assert.doesNotMatch(result.html, /Fixture item/);
  console.log('PASS wrong-account 404 safe presentation');

  mode = 'two-factor';
  result = await request('/record/purchases');
  assert.ok(result.response.headers.get('location')?.includes('/record/security?required=1')
    || result.html.includes('/record/security?required=1'));
  console.log('PASS required two-factor redirect');

  mode = 'expired';
  result = await request('/record/purchases');
  assert.match(result.html, /Sign in again/);
  console.log('PASS expired session sign-in state');

  mode = 'unavailable';
  result = await request('/record/purchases');
  assert.match(result.html, /load your orders right now/);
  assert.doesNotMatch(result.html, /No orders from this site are connected/);
  mode = 'disconnect';
  result = await request('/record/purchases');
  assert.match(result.html, /load your orders right now/);
  mode = 'empty';
  result = await request('/record/purchases');
  assert.match(result.html, /No orders from this site are connected/);
  console.log('PASS backend HTTP/transport failures distinct from empty history');

  mode = 'clinical-disconnect';
  result = await request('/record');
  assert.equal(result.response.status, 200);
  assert.match(result.html, /View orders from this site/);
  console.log('PASS local history navigation survives clinical transport failure');
  if (process.env.PORTAL_PLAYWRIGHT_MODULE) {
    const { chromium } = await import(process.env.PORTAL_PLAYWRIGHT_MODULE);
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', serviceWorkers: 'block' });
      // Browsers have their own networking; permit only this synthetic portal.
      await context.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await context.addCookies([{ name: 'prx_session', value: cookie.slice('prx_session='.length), url: base, httpOnly: true, sameSite: 'Strict' }]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const fit = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page has horizontal overflow');
      const screenshot = async (name) => {
        if (process.env.PORTAL_SCREENSHOTS_DIR) await page.screenshot({ path: `${process.env.PORTAL_SCREENSHOTS_DIR}/${name}.png`, fullPage: true });
      };
      detail.items[0].name = 'LongItem'.repeat(40);
      detail.prescribe_rx_order_number = 'ORDER'.repeat(40);
      detail.shipments[0].carrier = 'Carrier'.repeat(40);
      detail.shipments[0].tracking_number = 'TRACK'.repeat(60);
      detail.shipments[0].tracking_url = 'https://carrier.example.test/tracking';
      mode = 'slow';
      await page.goto(base + '/record/purchases', { waitUntil: 'commit' });
      await page.getByRole('status').filter({ hasText: 'Loading your orders' }).waitFor();
      await page.getByRole('link', { name: /^View order/ }).waitFor();
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 812 });
        mode = 'list';
        await page.goto(base + '/record/purchases');
        await page.getByRole('link', { name: /^View order/ }).waitFor();
        await fit();
        const link = page.getByRole('link', { name: /^View order/ });
        await page.keyboard.press('Tab');
        for (let i = 0; i < 12 && !await link.evaluate((el) => el === document.activeElement); i++) await page.keyboard.press('Tab');
        assert.ok(await link.evaluate((el) => el === document.activeElement), 'View order reachable with keyboard');
        assert.notEqual(await link.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Order details', exact: true }).waitFor();
        await fit();
        assert.ok((await page.getByRole('link', { name: /Track shipment/ }).boundingBox()).height >= 44);
        await screenshot(`purchase-detail-${width}`);
        for (const chartMode of ['single', 'flat']) {
          mode = chartMode;
          await page.goto(base + '/health');
          const chart = page.getByRole('img', { name: 'Weight, latest 185 lbs' });
          await chart.waitFor();
          await fit();
          assert.ok(await chart.locator('.prx-chart__target-label').isVisible());
          assert.equal(await chart.locator('.prx-chart__target-label').textContent(), 'Goal 185 lbs');
          assert.ok(!/NaN|Infinity/.test(await chart.innerHTML()));
          if (chartMode === 'flat') assert.ok(await chart.evaluate((el) => Boolean(el.querySelector('polyline').compareDocumentPosition(el.querySelector('.prx-chart__target')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'Goal remains visible above a flat reading stroke');
          const range = page.locator('.prx-chart__range').first();
          await page.waitForFunction(() => document.querySelector('.prx-chart__range time')?.textContent.includes('Sep') || document.querySelector('.prx-chart__range time')?.textContent.includes('Dec'));
          assert.ok((await range.innerText()).includes(chartMode === 'single' ? 'Sep 13, 2026' : 'Dec 31, 2025'));
          assert.equal(await range.getAttribute('aria-hidden'), null);
          const accessible = await page.locator('.prx-chart').first().ariaSnapshot();
          assert.ok(accessible.includes('Weight, latest 185 lbs'));
          assert.ok(accessible.includes('Sep 13, 2026'));
          assert.ok(accessible.includes('goal of 185 lbs'));
          assert.ok(!accessible.includes('2026-09-14'), 'Accessible chart uses local dates, not UTC dates');
          await screenshot(`health-${chartMode}-${width}`);
        }
        for (const state of ['empty', 'unavailable']) {
          mode = state;
          await page.goto(base + '/record/purchases');
          await page.getByText(state === 'empty' ? 'No orders from this site are connected to your account yet.' : 'We can’t load your orders right now. Please try again in a moment.').waitFor();
          await fit();
        }
      }
      assert.deepEqual(errors, [], 'No browser runtime or hydration errors');
      console.log('PASS browser: 320/390/1280px, long values, keyboard navigation/focus, tracking target, single/flat goal charts, local accessible dates, empty/failure states');
    } finally { await browser.close(); }
  }
  console.log('PASS all rendered responses no-store/noindex; no bearer/admin-host/raw-private-field leaks');
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await new Promise((resolve) => admin.close(resolve));
}
