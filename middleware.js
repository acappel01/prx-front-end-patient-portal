import { NextResponse } from 'next/server';

import { PAYMENT_CSP_HEADER } from '@/lib/paymentPage';
import { isPaymentPath, newNonce, securityHeaders } from '@/lib/securityHeaders';

/**
 * Security headers for every page: a nonce-based Content-Security-Policy,
 * HSTS and Permissions-Policy (lib/securityHeaders.js says what the policy
 * allows and why, and which routes take a card and allow its gateway).
 *
 * Headers only. This middleware never reads the session or decides access:
 * the `(portal)` layout stays the one session gate, and each route handler
 * under app/api checks the session itself (docs/security/dev.md).
 *
 * The policy goes on the REQUEST too, because that is where the App Router
 * reads the nonce it stamps on its own inline bootstrap script. Every page is
 * rendered per request (the root layout is force-dynamic), so each one gets a
 * fresh nonce.
 */
export function middleware(request) {
  // Record > Membership takes a card: its policy also lets the gateway SDKs in.
  const payment = isPaymentPath(request.nextUrl.pathname);
  const headers = securityHeaders({ nonce: newNonce(), payment });

  const forwarded = new Headers(request.headers);
  forwarded.set('Content-Security-Policy', headers['Content-Security-Policy']);
  // For the root layout, which marks the document (lib/paymentPage.js). Set
  // here, never trusted from the browser: the incoming value is overwritten.
  forwarded.set(PAYMENT_CSP_HEADER, payment ? 'on' : 'off');

  const response = NextResponse.next({ request: { headers: forwarded } });

  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);

  return response;
}

export const config = {
  // Node, not the edge runtime: the policy reads the deployment's env
  // (ADMIN_API_BASE_URL, CSP_*) at request time, as every other server file does.
  runtime: 'nodejs',
  // Static assets and the relayed font files carry no document, so no policy.
  matcher: ['/((?!_next/static|_next/image|fonts/file/).*)'],
};
