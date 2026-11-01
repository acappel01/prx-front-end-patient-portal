/**
 * What the sign-in routes say when the admin does not hand back a session.
 *
 * Only the admin's own credential refusal is "did not match": a 422 (the
 * login's validation answer, `AuthController::login`) or a 401. Everything
 * else used to be folded into it too — a 5xx, a 503 maintenance page, a 404
 * from an `ADMIN_API_BASE_URL` missing `/api/v1` — so during an outage
 * patients were told their password was wrong, retyped it into the per-address
 * sign-in limiter and locked themselves out, while operators heard nothing.
 * Now an outage says so, carries the admin's Reference, and is logged with the
 * status and request id: never the email, never the password.
 *
 * Pure, no Next imports: the route turns the answer into a response, and
 * `node --test` covers the mapping.
 */

export const NO_MATCH = 'Those details did not match.';
export const TOO_MANY = 'Too many sign-in attempts from this network. Wait a minute, then try again.';
export const UNREACHABLE = 'We couldn’t reach the server. Try again in a moment.';
export const UNAVAILABLE = 'We couldn’t sign you in right now. Please try again in a few minutes.';

/**
 * `result` is adminFetch()'s answer that held no session. Returns the status
 * and message to answer the browser with, the Reference to show, and the line
 * to log (or null when there is nothing for an operator to see).
 */
export function signInRefusal(result, route = '/patient/auth/login') {
  if (result.status === 0) {
    // adminFetch already logged the unreachable call.
    return { status: 503, message: UNREACHABLE, requestId: null, log: null };
  }

  if (result.status === 429) {
    // The limiter is per network address, never per account, so saying so
    // reveals nothing about whether the address belongs to a patient.
    return { status: 429, message: TOO_MANY, requestId: null, log: null };
  }

  if (result.status === 422 || result.status === 401) {
    // One message for a bad password and for an unknown address.
    // Distinguishing them turns sign-in into an account-existence oracle, which
    // for a clinical service leaks that a named person is a patient.
    return { status: 401, message: NO_MATCH, requestId: null, log: null };
  }

  const requestId = result.requestId ?? null;

  return {
    status: 503,
    message: UNAVAILABLE,
    requestId,
    log: `[session] admin answered HTTP ${result.status} on ${route}${requestId ? ` (request ${requestId})` : ''}${result.ok ? ' without a session' : ''}`,
  };
}
