import LocalTime from '@/components/ui/LocalTime';
import { adminFetch } from '@/lib/adminApi';

/**
 * Sign-in activity — the account's own security history, from
 * `GET /patient/security/events`.
 *
 * WHY A PATIENT SEES IT. "Was that me?" is a question only the account holder
 * can answer. A sign-in from a device or place they don't recognise, or failed
 * attempts they didn't make, is the earliest sign someone else has the password
 * — and the answer (reset it from the sign-in page) needs no support ticket.
 *
 * The admin already decides what is safe to show: its resource is a whitelist,
 * so nothing here filters. In particular a failed attempt never says whether the
 * address or the password was wrong.
 *
 * A server component, so the call carries the patient's session and address
 * through `adminFetch`, and no browser path or proxy entry exists for it.
 *
 * Its own failure is quiet. It sits under the orders on Record, and a history
 * the admin answers with an error (or not at all) must not push a whole screen
 * into an error state.
 *
 * On changes staff made, the admin sends no address or browser — they would be
 * the support desk's — so those rows show only "by support".
 */

const LIMIT = 10;

/**
 * "Safari on iPhone" rather than a 120-character user agent. Deliberately
 * coarse, ordered most-specific first (Edge and Chrome both claim Safari), and
 * falls back to the raw string rather than guessing.
 */
function describeDevice(userAgent) {
  if (!userAgent) return null;

  const browser = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/Firefox\/|FxiOS/, 'Firefox'],
    [/Chrome\/|CriOS/, 'Chrome'],
    [/Safari\//, 'Safari'],
  ].find(([pattern]) => pattern.test(userAgent))?.[1];

  const system = [
    [/iPhone/, 'iPhone'],
    [/iPad/, 'iPad'],
    [/Android/, 'Android'],
    [/Macintosh|Mac OS X/, 'Mac'],
    [/Windows/, 'Windows'],
    [/Linux/, 'Linux'],
  ].find(([pattern]) => pattern.test(userAgent))?.[1];

  if (browser && system) return `${browser} on ${system}`;

  return browser ?? system ?? userAgent.slice(0, 60);
}

function who(event) {
  if (event.actor === 'operator') return 'by support';
  if (event.actor === 'system') return 'automatically';

  return null;
}

export default async function SecurityHistory() {
  // adminFetch throws on a network failure rather than returning !ok; caught
  // here so an unreachable admin hides this section, not the Record screen.
  const response = await adminFetch(`/patient/security/events?limit=${LIMIT}`).catch(() => null);

  if (!response?.ok) return null;

  const { data, meta } = response;

  const events = Array.isArray(data) ? data : [];

  return (
    <section className="prx-security" aria-labelledby="prx-security-heading">
      <h2 id="prx-security-heading">Sign-in activity</h2>
      <p className="prx-lede prx-muted">
        Don&rsquo;t recognise something here? Sign out, then reset your password from the sign-in page.
      </p>

      {events.length === 0 ? (
        <p className="prx-muted">No activity recorded yet.</p>
      ) : (
        <ul className="prx-rows">
          {events.map((event, index) => {
            const device = describeDevice(event.user_agent);
            const detail = [device, event.ip_address, who(event)].filter(Boolean).join(' · ');

            return (
              // The admin sends no row id on purpose; the list is newest-first
              // and re-rendered whole, so position is a stable enough key.
              <li className="prx-row" key={`${event.occurred_at}-${index}`}>
                <span className="prx-security__what">
                  {event.label}
                  {event.is_current_session ? <span className="prx-security__current"> · This device</span> : null}
                  {detail ? (
                    <>
                      <br />
                      <span className="prx-row__meta">{detail}</span>
                    </>
                  ) : null}
                </span>
                <span className="prx-row__meta prx-security__when">
                  <LocalTime value={event.occurred_at} />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {meta?.retention_days ? (
        <p className="prx-security__note prx-muted">Kept for {meta.retention_days} days.</p>
      ) : null}
    </section>
  );
}
