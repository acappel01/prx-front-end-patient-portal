import 'server-only';

/**
 * The browser's only route to the admin — and it is an ALLOWLIST, never a
 * passthrough.
 *
 * A relay that forwards any path while holding a patient's session token is a
 * worse hole than the one it closes: it turns this app into a credential-
 * lending service for the whole admin API. Every entry below is a deliberate
 * decision that a browser may reach that path. A 404 through this proxy is the
 * list working, not a bug.
 *
 * Two rules for adding an entry:
 *
 * 1. **A path parameter is matched, never interpolated.** Patterns are anchored
 *    regexes over a fixed segment shape, so `../` and an encoded slash cannot
 *    walk out of the prefix.
 *
 * 2. **If the admin does not pin the id to the session, it does not belong
 *    here.** The admin's PortalController resolves every identifier from the
 *    authenticated patient's own record; a path that trusts a caller-supplied
 *    id must be fixed there before it is exposed here.
 *
 * Most reads deliberately do NOT appear below. Screens are server components:
 * they call the admin directly through `adminApi`, which never exposes the path
 * to the browser at all. This proxy exists only for interactions that must
 * happen after hydration — posting a vital, sending a message, booking.
 */

const UUID = '[0-9a-fA-F-]{36}';

const ALLOWLIST = [
  // Vitals capture. The empty-state tiles ask for a reading, so this is the
  // most-used write in the app.
  { method: 'POST', pattern: new RegExp('^/patient/vitals$') },
  // The weight goal. The admin validates the provider's bounds; the value lives
  // on the patient's own chart.
  { method: 'POST', pattern: new RegExp('^/patient/vitals/goals$') },

  // Connecting the medical record an order created, in two steps with an email
  // between them. The first takes no body — the admin resolves the order from
  // the session and mails the ORDER's address. The second carries the token in
  // the body, never a path, so it cannot land in a URL or a log line through us.
  // The old `/patient/link-chart` (an order uuid on the caller's word) is gone
  // upstream and must not come back here.
  { method: 'POST', pattern: new RegExp('^/patient/claim-links$') },
  { method: 'POST', pattern: new RegExp('^/patient/claim$') },

  // Two-step verification, managed from Record → Security. Every one of these
  // acts only on the session's own account, and each needs a code (or, to turn
  // it off, the password too) — the admin checks both.
  { method: 'POST', pattern: new RegExp('^/patient/two-factor/setup$') },
  { method: 'POST', pattern: new RegExp('^/patient/two-factor/confirm$') },
  { method: 'POST', pattern: new RegExp('^/patient/two-factor/recovery-codes$') },
  { method: 'POST', pattern: new RegExp('^/patient/two-factor/disable$') },
  // Trusted browsers — the id is a public uuid the admin resolves only within
  // the session's own account (another patient's uuid is a 404).
  { method: 'POST', pattern: new RegExp(`^/patient/trusted-devices/${UUID}/revoke$`) },
  { method: 'POST', pattern: new RegExp('^/patient/trusted-devices/revoke-all$') },

  // Messaging. Read is polled because the provider's real-time channel cannot
  // authorise a bearer token (see the API-parity note in docs/).
  { method: 'GET', pattern: new RegExp('^/patient/conversations$') },
  { method: 'GET', pattern: new RegExp(`^/patient/conversations/${UUID}/messages$`) },
  { method: 'POST', pattern: new RegExp(`^/patient/conversations/${UUID}/messages$`) },
  // Open (or reuse) the conversation for one of the patient's visits; the
  // provider only finds encounters on the session's own chart.
  { method: 'POST', pattern: new RegExp(`^/patient/encounters/${UUID}/conversation$`) },

  // Scheduling. The admin pins the chart id and proves encounter ownership
  // before either of these reaches the provider.
  { method: 'GET', pattern: new RegExp('^/patient/scheduling/slots$') },
  { method: 'POST', pattern: new RegExp('^/patient/scheduling/appointments$') },

  // The video credential is fetched at join time, never at render time, so it
  // is not sitting in a server-rendered page waiting to be scraped from the
  // DOM by anything that gets a foothold.
  { method: 'GET', pattern: new RegExp(`^/patient/encounters/${UUID}/video-token$`) },
];

/**
 * Decide whether the browser may reach `path` with `method`.
 *
 * `path` must already be normalised — leading slash, no query string, no
 * scheme. The caller does that; this function only decides.
 */
export function isAllowed(method, path) {
  return ALLOWLIST.some(
    (entry) => entry.method === method.toUpperCase() && entry.pattern.test(path)
  );
}

/**
 * Join a route's catch-all segments into a path, refusing anything that could
 * escape the prefix.
 *
 * Next has already decoded each segment, so a `%2F` in the URL arrives here as
 * a literal slash inside ONE segment — which would let `a%2F..%2Fb` pass a
 * naive check and then mean something else entirely upstream. Rejecting any
 * segment containing a slash, a backslash or a dot-segment is cheaper and more
 * obviously correct than trying to re-normalise it.
 */
export function safePath(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return null;

  for (const segment of segments) {
    if (typeof segment !== 'string' || segment === '') return null;
    if (segment === '.' || segment === '..') return null;
    if (segment.includes('/') || segment.includes('\\')) return null;
    if (segment.includes('\0')) return null;
  }

  return `/${segments.join('/')}`;
}
