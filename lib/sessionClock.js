/**
 * The session's two deadlines, as the tab counts them.
 *
 * The admin ends a patient session at whichever comes first: the idle limit
 * (`idle_expires_at`, moved forward by every use) or the absolute cap
 * (`expires_at`, 12 hours by default, which nothing moves). `GET /api/session`
 * returns both, plus `now` from the portal server's clock, so the countdown is
 * measured against the admin's deadlines rather than the device's clock, which
 * may be minutes out. The warning comes WARN_BEFORE_MS before the earlier one.
 *
 * Only the idle deadline can be pushed back ("Stay signed in"). Near the
 * absolute cap the only honest offer is time to finish: the patient is told to
 * save what they are writing, because signing in again is the only way on.
 *
 * Pure: no React, no fetch, so `node --test` covers it.
 */

export const WARN_BEFORE_MS = 2 * 60 * 1000;

/**
 * Local-clock deadlines from one keep-alive answer, or null when the answer
 * carries neither. `localNow` is when the answer arrived.
 *
 * @param {Partial<import('@/lib/models').SessionDeadlines> | null | undefined} data
 * @param {number} [localNow]
 */
export function deadlinesFrom(data, localNow = Date.now()) {
  const idle = Date.parse(data?.idle_expires_at ?? '');
  const absolute = Date.parse(data?.expires_at ?? '');

  if (!Number.isFinite(idle) && !Number.isFinite(absolute)) return null;

  const serverNow = Date.parse(data?.now ?? '');
  const skew = Number.isFinite(serverNow) ? localNow - serverNow : 0;

  return {
    idleAt: Number.isFinite(idle) ? idle + skew : null,
    absoluteAt: Number.isFinite(absolute) ? absolute + skew : null,
  };
}

/**
 * Where the session stands at `now`: `phase` is 'unknown' (no deadlines yet),
 * 'ok', 'warn' or 'ended'; `reason` says which deadline is the nearer one
 * ('idle' or 'absolute'); `remainingMs` is the time until it.
 */
export function sessionPhase(deadlines, now = Date.now()) {
  if (!deadlines) return { phase: 'unknown', reason: null, remainingMs: null };

  const { idleAt, absoluteAt } = deadlines;
  const reason = absoluteAt !== null && (idleAt === null || absoluteAt <= idleAt) ? 'absolute' : 'idle';
  const remainingMs = (reason === 'absolute' ? absoluteAt : idleAt) - now;

  if (remainingMs <= 0) return { phase: 'ended', reason, remainingMs: 0 };
  if (remainingMs <= WARN_BEFORE_MS) return { phase: 'warn', reason, remainingMs };

  return { phase: 'ok', reason, remainingMs };
}
