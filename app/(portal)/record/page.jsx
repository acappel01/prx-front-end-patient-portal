import ProfileDetails from '@/components/account/ProfileDetails';
import SecurityHistory from '@/components/account/SecurityHistory';
import TwoFactorStatusLink from '@/components/account/TwoFactorStatusLink';
import Screen from '@/components/ui/Screen';
import LocalTime from '@/components/ui/LocalTime';
import SignOutButton from '@/components/ui/SignOutButton';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Record — the chart, re-cut by what the patient is DOING rather than by which
 * table the data lives in.
 *
 * Three jobs, not thirteen tabs: Maintain (data they own and that decays),
 * Reference (history they read and share), Operate (tools). Orders are the
 * first Reference group; the rest land as their endpoints are wired.
 *
 * Rows are keyed by an order NUMBER, never an internal identifier — a chart
 * keyed by ENC- ids is a clinician's tool shown to a patient.
 *
 * Sign out lives here, under Operate: Record is the account destination, and
 * the portal had no way to end a session at all. Sign-in activity sits directly
 * above it, because the one thing that list asks of a patient who doesn't
 * recognise an entry is to press that button.
 */
export default function RecordPage() {
  return (
    <>
      <Screen title="Your record" path="/patient/orders" empty="No orders yet.">
        {(rows) => (
          <ul className="prx-rows">
            {rows.map((order) => (
              <li className="prx-order" key={order.id ?? order.order_number}>
                <div className="prx-row">
                  <span>
                    {/* Lead with what is happening to it, in the admin's words. */}
                    <strong>{order.status_label ?? 'Order received'}</strong>
                    <br />
                    <span className="prx-row__meta">
                      {order.order_number}
                      {order.created_at ? (
                        <>
                          {' · '}
                          <LocalTime value={order.created_at} format="date" />
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="prx-row__meta">{money(order.grand_total, order.currency)}</span>
                </div>
                {/* One order can ship in several parcels, each with its own link. */}
                {(order.tracking ?? []).length > 0 ? (
                  <ul className="prx-order__tracking">
                    {order.tracking.map((parcel, index) => (
                      <li key={parcel.number ?? parcel.url ?? index}>
                        {parcel.url ? (
                          <a href={parcel.url} target="_blank" rel="noopener noreferrer">
                            {order.tracking.length > 1 ? `Track parcel ${index + 1}` : 'Track your parcel'}
                          </a>
                        ) : (
                          <span className="prx-row__meta">Tracking number {parcel.number}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Screen>
      <ProfileDetails />
      <TwoFactorStatusLink />
      <SecurityHistory />
      <SignOutButton />
    </>
  );
}
