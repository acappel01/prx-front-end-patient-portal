/**
 * When the record-copy panel checks again after a failed check, and when it
 * stops and says so.
 *
 * The poll used to be re-armed only by a state change, and a failed check (a
 * 429, a 5xx, a dropped connection) changed nothing — so polling stopped for
 * good and the panel said "preparing" forever. Now every failed check counts,
 * the next one waits longer (doubling from the normal interval, capped, and
 * never sooner than a 429's Retry-After), and after MAX_POLL_FAILURES in a row
 * the panel shows an error with the Reference and a way to check again.
 * A 401 never gets here: `portalCall()` sends the patient to sign in.
 *
 * Pure: no React, no fetch, so `node --test` covers it.
 */

export const POLL_MS = 5000;
export const MAX_POLL_MS = 60_000;
export const MAX_POLL_FAILURES = 5;

/** Milliseconds before the next check, given the failures in a row so far. */
export function pollDelay(failures = 0, retryAfterSeconds = null) {
  if (!failures) return POLL_MS;

  const backoff = Math.min(MAX_POLL_MS, POLL_MS * 2 ** failures);

  return Math.max(backoff, retryAfterSeconds ? retryAfterSeconds * 1000 : 0);
}

/**
 * The panel's next state after one check. `state` is the panel's state,
 * `response` is portalCall()'s answer.
 *
 * @param {object} state
 * @param {import('@/lib/models').CallResult<import('@/lib/models').RecordExport>} response
 */
export function afterPoll(state, response) {
  if (response.ok && response.data) {
    return { ...response.data, status: response.data.ready ? 'ready' : response.data.status, failures: 0 };
  }

  const failures = (state.failures ?? 0) + 1;

  if (failures >= MAX_POLL_FAILURES) {
    return { status: 'poll_failed', failures, reference: response.status >= 500 ? response.requestId : null };
  }

  // Same status, one more failure: the changed state is what re-arms the timer.
  return { ...state, failures, retryAfter: response.retryAfter ?? null };
}
