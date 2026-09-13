import SecurityHistory from '@/components/account/SecurityHistory';
import TwoFactorStatusLink from '@/components/account/TwoFactorStatusLink';
import Screen from '@/components/ui/Screen';
import SignOutButton from '@/components/ui/SignOutButton';

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
              <li className="prx-row" key={order.id}>
                <span>
                  {order.order_number}
                  <br />
                  <span className="prx-row__meta">{order.shipping_status ?? order.workflow_status}</span>
                </span>
                <span className="prx-row__meta">{order.grand_total}</span>
              </li>
            ))}
          </ul>
        )}
      </Screen>
      <TwoFactorStatusLink />
      <SecurityHistory />
      <SignOutButton />
    </>
  );
}
