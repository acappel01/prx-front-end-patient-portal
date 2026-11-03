import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { register } from 'node:module';
import { describe, it } from 'node:test';

// Replacing a membership's card: only Record > Membership is served with the
// gateways' hosts allowed, the document says which policy it has, the proxy
// lets exactly the two card calls through, and no card input carries a name.
register('./support/hooks.mjs', import.meta.url);

const { GATEWAY_SOURCES, contentSecurityPolicy, isPaymentPath, paymentSources } = await import('../lib/securityHeaders.js');
const { PAYMENT_CSP_ATTRIBUTE, documentAllowsPayment } = await import('../lib/paymentPage.js');
const { isAllowed } = await import('../lib/portalProxy.js');

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';
const ENV = { ADMIN_API_BASE_URL: 'https://admin.example.test/api/v1', NODE_ENV: 'production' };
const ID = '0b0e7c43-6d2a-4a59-9a77-1c1a1f6a1b11';

function parse(policy) {
  return Object.fromEntries(policy.split('; ').map((part) => {
    const [name, ...sources] = part.split(' ');

    return [name, sources];
  }));
}

describe('payment routes', () => {
  it('are exactly Record > Membership', () => {
    for (const path of ['/record/membership', '/record/membership/', '/RECORD/membership', '//record/membership', '/record/membership?update=x']) {
      assert.equal(isPaymentPath(path), true, path);
    }

    for (const path of ['/', '/record', '/record/memberships', '/record/membership/x', '/api/portal/patient/memberships', null, '']) {
      assert.equal(isPaymentPath(path), false, String(path));
    }
  });

  it('add every gateway host to script, connect and frame on that route only', () => {
    const strict = parse(contentSecurityPolicy({ nonce: NONCE, env: ENV }));
    const payment = parse(contentSecurityPolicy({ nonce: NONCE, env: ENV, payment: true }));

    assert.deepEqual(strict['script-src'], ["'self'", `'nonce-${NONCE}'`]);
    assert.equal(strict['frame-src'], undefined);

    for (const gateway of Object.values(GATEWAY_SOURCES)) {
      for (const host of gateway.script) {
        assert.ok(payment['script-src'].includes(host), host);
        assert.ok(payment['connect-src'].includes(host), host);
        assert.ok(payment['frame-src'].includes(host), host);
      }

      for (const host of gateway.connect ?? []) assert.ok(payment['connect-src'].includes(host), host);
    }

    // Never a keyword that would reopen inline or any-host script.
    for (const source of payment['script-src']) {
      assert.ok(!["'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", '*', 'https:'].includes(source), source);
    }
  });

  it('take an operator gateway host, and nothing that is not an https host', () => {
    const sources = paymentSources({ PAYMENT_CSP_GATEWAY_HOSTS: 'https://secure.reseller.test, http://plain.test https://x.test/path * ; script-src' });

    assert.ok(sources['script-src'].includes('https://secure.reseller.test'));
    assert.ok(!sources['script-src'].some((source) => /plain|path|\*$|;|script-src/.test(source)));
  });
});

describe('payment document marker', () => {
  const doc = (value) => ({ documentElement: { getAttribute: (name) => (name === PAYMENT_CSP_ATTRIBUTE ? value : null) } });

  it('is on only when the layout said so', () => {
    assert.equal(documentAllowsPayment(doc('on')), true);
    assert.equal(documentAllowsPayment(doc('off')), false);
    assert.equal(documentAllowsPayment(doc(null)), false);
    assert.equal(documentAllowsPayment(undefined), false);
  });
});

describe('card proxy entries', () => {
  it('allow the card form and the token for a membership, and nothing near them', () => {
    assert.ok(isAllowed('GET', `/patient/memberships/${ID}/gateway-config`));
    assert.ok(isAllowed('POST', `/patient/memberships/${ID}/card`));
    assert.ok(!isAllowed('GET', `/patient/memberships/${ID}/card`));
    assert.ok(!isAllowed('POST', `/patient/memberships/${ID}/gateway-config`));
    assert.ok(!isAllowed('POST', `/patient/memberships/not-a-uuid/card`));
    assert.ok(!isAllowed('GET', '/checkout/gateway-config'));
  });
});

describe('card inputs', () => {
  it('carry no name attribute, so no form serialisation or scraper picks them up', () => {
    const dir = new URL('../components/payments/gateways/', import.meta.url);

    for (const file of readdirSync(dir)) {
      const source = readFileSync(new URL(file, dir), 'utf8');

      assert.ok(!/<input[^>]*\sname=/.test(source), file);
    }
  });
});
