/**
 * Whether this document was served under the payment Content-Security-Policy
 * (lib/securityHeaders.js, PAYMENT_PATHS), which is what lets a gateway's card
 * SDK load.
 *
 * WHY IT IS ASKED. A client-side navigation keeps the policy the document
 * was first loaded with, so a patient who reached Record > Membership from
 * another portal screen has the strict policy and the gateway's script would
 * be refused. The middleware tells the root layout which policy it served
 * (PAYMENT_CSP_HEADER), the layout writes it on <html> (PAYMENT_CSP_ATTRIBUTE),
 * and the card form reloads the page first when it says "off".
 *
 * Plain module, no React: `node --test` imports it.
 */

/** The request header the middleware sets for the root layout. */
export const PAYMENT_CSP_HEADER = 'x-payment-csp';

/** The attribute on <html>: "on" when the document allows the gateways. */
export const PAYMENT_CSP_ATTRIBUTE = 'data-payment-csp';

/**
 * True when the current document may load a gateway SDK.
 *
 * @param {Document | undefined} [doc]
 */
export function documentAllowsPayment(doc = typeof document === 'undefined' ? undefined : document) {
  return doc?.documentElement?.getAttribute(PAYMENT_CSP_ATTRIBUTE) === 'on';
}
