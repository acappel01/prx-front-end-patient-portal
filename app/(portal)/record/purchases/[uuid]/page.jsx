import { notFound, redirect } from 'next/navigation';

import PurchaseError from '@/components/orders/PurchaseError';
import LocalTime from '@/components/ui/LocalTime';
import { adminFetch } from '@/lib/adminApi';
import { formatMoney, isOrderUuid, loadOrderDetail, PURCHASES_PATH, safeTrackingUrl, statusLabel } from '@/lib/commerceHistory.mjs';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PurchasePage({ params }) {
  const token = await sessionToken();
  if (!token) redirect('/login');
  const { uuid } = await params;
  if (!isOrderUuid(uuid)) notFound();
  const result = await loadOrderDetail((path) => adminFetch(path, { token }), uuid);
  if (result.state === 'two-factor') redirect('/record/security?required=1');
  const order = result.data;

  return (
    <div className="prx-purchases">
      <p><a href={PURCHASES_PATH}>Back to orders from this site</a></p>
      <h1>Order details</h1>
      {result.state !== 'ready' ? <PurchaseError result={result} detail /> : (
        <>
          <p className="prx-muted">An order placed through this site and connected to your account. <a href="/record">Clinical order history</a> remains separate.</p>
          <section className="prx-card" aria-labelledby="order-summary">
            <h2 id="order-summary">{order.prescribe_rx_order_number || 'Order summary'}</h2>
            <p>{statusLabel(order.status)}</p>
            <dl className="prx-purchases__facts">
              <div><dt>Placed</dt><dd>{order.placed_at ? <LocalTime value={order.placed_at} /> : 'Not recorded'}</dd></div>
              {['shipped', 'delivered', 'cancelled'].map((stage) => order[`${stage}_at`] ? (
                <div key={stage}><dt>{statusLabel(stage)}</dt><dd><LocalTime value={order[`${stage}_at`]} /></dd></div>
              ) : null)}
              {[['subtotal', 'Subtotal'], ['tax_amount', 'Tax'], ['shipping_amount', 'Shipping'],
                ['discount_amount', 'Discount'], ['total_amount', 'Order total']].map(([field, label]) => (
                <div key={field}><dt>{label}</dt><dd>{formatMoney(order[field], order.currency)}</dd></div>
              ))}
            </dl>
            <p className="prx-muted">These are recorded order amounts. They do not confirm that a payment was collected.</p>
          </section>
          <section aria-labelledby="order-items">
            <h2 id="order-items">Items</h2>
            {order.items.length === 0 ? <p className="prx-muted">No item details recorded.</p> : (
              <ul className="prx-rows">
                {order.items.map((item, index) => (
                  <li className="prx-card" key={item.id ?? index}>
                    <h3>{item.name || 'Order item'}</h3>
                    <p>Quantity {item.quantity} · {formatMoney(item.unit_price, order.currency)} each</p>
                    <p>Line total {formatMoney(item.line_total, order.currency)}</p>
                    {item.billing_period ? <p className="prx-muted">Billing period: {item.billing_period}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="order-shipments">
            <h2 id="order-shipments">Shipments</h2>
            {order.shipments.length === 0 ? <p className="prx-muted">No shipment details recorded yet.</p> : (
              <ul className="prx-rows">
                {order.shipments.map((shipment, index) => {
                  const tracking = safeTrackingUrl(shipment.tracking_url);
                  return (
                    <li className="prx-card" key={shipment.id ?? index}>
                      <h3>{shipment.carrier || 'Shipment'} · {statusLabel(shipment.status)}</h3>
                      {shipment.tracking_number ? <p className="prx-purchases__reference">Tracking: {shipment.tracking_number}</p> : null}
                      {shipment.shipped_at ? <p>Shipped <LocalTime value={shipment.shipped_at} /></p> : null}
                      {shipment.delivered_at ? <p>Delivered <LocalTime value={shipment.delivered_at} /></p> : null}
                      {tracking ? <a href={tracking} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Track shipment <span className="prx-visually-hidden">(opens a new tab)</span></a> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
