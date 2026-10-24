import { notFound } from 'next/navigation';

import TrackingLinks from '@/components/record/TrackingLinks';
import LocalTime from '@/components/ui/LocalTime';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * One order's shipments. An order filled by more than one pharmacy ships in
 * parts, each with its own status and tracking link; before any part exists,
 * the order's own tracking is all there is.
 */
export default async function OrderShipmentsPage({ params }) {
  const { id } = await params;

  if (!UUID.test(id)) notFound();

  return (
    <>
      <BackLink />
      <Screen title="Your shipments" path={`/patient/orders/${id}/tracking`} empty="Nothing has shipped yet." rowsOf={shipmentsOf}>
        {(rows) => <Shipments rows={rows} />}
      </Screen>
    </>
  );
}

/** Per-pharmacy shipments, or the order's own tracking before any exist. */
function shipmentsOf(data) {
  if ((data?.shipments ?? []).length > 0) return data.shipments;

  return (data?.tracking ?? []).length > 0 ? [{ status_label: 'Shipped', tracking: data.tracking }] : [];
}

function Shipments({ rows }) {
  return (
    <ul className="prx-rows">
      {rows.map((shipment, index) => (
        <li className="prx-order" key={shipment.number ?? index}>
          <div className="prx-row">
            <span>
              <strong>{shipment.status_label}</strong>
              <br />
              <span className="prx-row__meta">
                {rows.length > 1 ? `Part ${index + 1} of ${rows.length}` : 'Your parcel'}
                {shipment.delivered_at ? (
                  <>
                    {' · delivered '}
                    <LocalTime value={shipment.delivered_at} format="date" />
                  </>
                ) : shipment.shipped_at ? (
                  <>
                    {' · shipped '}
                    <LocalTime value={shipment.shipped_at} format="date" />
                  </>
                ) : null}
              </span>
            </span>
          </div>
          <TrackingLinks tracking={shipment.tracking ?? []} />
        </li>
      ))}
    </ul>
  );
}
