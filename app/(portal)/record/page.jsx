import ProfileDetails from '@/components/account/ProfileDetails';
import TrackingLinks from '@/components/record/TrackingLinks';
import SecurityHistory from '@/components/account/SecurityHistory';
import TwoFactorStatusLink from '@/components/account/TwoFactorStatusLink';
import Screen from '@/components/ui/Screen';
import LocalTime from '@/components/ui/LocalTime';
import SignOutButton from '@/components/ui/SignOutButton';
import { deploymentConfig } from '@/lib/adminApi';
import { money } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Record — the chart, re-cut by what the patient is DOING rather than by which
 * table the data lives in.
 *
 * Three jobs, not thirteen tabs: Maintain (data they own and that decays:
 * medications, allergies and conditions), Reference (history they read and
 * share: orders and visits), Operate (messages, a copy of the record, security,
 * sign out). Maintain is hidden when the install leaves those lists to the care
 * team (`portal.modules.health_record`).
 *
 * Rows are keyed by an order NUMBER, never an internal identifier — a chart
 * keyed by ENC- ids is a clinician's tool shown to a patient.
 *
 * Sign out lives here, under Operate: Record is the account destination, and
 * the portal had no way to end a session at all. Sign-in activity sits directly
 * above it, because the one thing that list asks of a patient who doesn't
 * recognise an entry is to press that button.
 */
export default async function RecordPage() {
  const config = await deploymentConfig();
  const maintain = config?.portal?.modules?.health_record !== false;

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
                <TrackingLinks tracking={order.tracking ?? []} />
                {order.id && order.shipping_status && order.shipping_status !== 'none' ? (
                  <p className="prx-row__meta">
                    <a href={`/record/orders/${order.id}`}>See every shipment</a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Screen>
      {maintain ? (
        <section className="prx-record-links" aria-labelledby="prx-maintain-heading">
          <h2 id="prx-maintain-heading">Keep this accurate</h2>
          <ul className="prx-rows">
            <li className="prx-row">
              <a href="/record/health">
                Medications, allergies and conditions <span aria-hidden="true">›</span>
              </a>
            </li>
          </ul>
        </section>
      ) : null}
      <section className="prx-record-links" aria-labelledby="prx-reference-heading">
        <h2 id="prx-reference-heading">Your account</h2>
        <ul className="prx-rows">
          <li className="prx-row">
            <a href="/record/visits">
              Past visits <span aria-hidden="true">›</span>
            </a>
          </li>
          <li className="prx-row">
            <a href="/record/notifications">
              Messages we send you <span aria-hidden="true">›</span>
            </a>
          </li>
          <li className="prx-row">
            <a href="/record/export">
              Get a copy of your record <span aria-hidden="true">›</span>
            </a>
          </li>
        </ul>
      </section>
      <ProfileDetails />
      <TwoFactorStatusLink />
      <SecurityHistory />
      <SignOutButton />
    </>
  );
}
