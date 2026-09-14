import { redirect } from 'next/navigation';

import PurchaseError from '@/components/orders/PurchaseError';
import LocalTime from '@/components/ui/LocalTime';
import { adminFetch } from '@/lib/adminApi';
import { formatMoney, historyPage, loadOrderHistory, PURCHASES_PATH, statusLabel } from '@/lib/commerceHistory.mjs';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage({ searchParams }) {
  const token = await sessionToken();
  if (!token) redirect('/login');
  const page = historyPage((await searchParams)?.page);
  const result = await loadOrderHistory((path) => adminFetch(path, { token }), page);
  if (result.state === 'two-factor') redirect('/record/security?required=1');

  return (
    <div className="prx-purchases">
      <p><a href="/record">Back to your record</a></p>
      <h1>Orders from this site</h1>
      <p className="prx-muted">Orders placed through this site and connected to your account. Your <a href="/record">clinical order history</a> is shown separately and may overlap.</p>
      {result.state !== 'ready' ? <PurchaseError result={result} /> : (
        <>
          {result.data.length === 0 ? (
            <div className="prx-stack__clear">
              <p>{page > 1 ? 'There are no orders on this page.' : 'No orders from this site are connected to your account yet.'}</p>
              {page > 1 ? <a href={PURCHASES_PATH}>Go to the first page</a> : <p><a href="/record">See your clinical order history</a></p>}
            </div>
          ) : (
            <ul className="prx-rows prx-purchases__list" aria-label="Orders from this site">
              {result.data.map((order) => (
                <li className="prx-card prx-purchases__order" key={order.uuid}>
                  <div>
                    <h2>{order.placed_at ? <>Placed <LocalTime value={order.placed_at} format="date" /></> : 'Order date not recorded'}</h2>
                    <p>{statusLabel(order.status)} <span aria-hidden="true">·</span> {order.items_count} line {order.items_count === 1 ? 'item' : 'items'}</p>
                  </div>
                  <div className="prx-purchases__amount">
                    <p><span className="prx-muted">Order total </span>{formatMoney(order.total_amount, order.currency)}</p>
                    <a className="prx-task__cta" href={`${PURCHASES_PATH}/${order.uuid}`}>View order<span className="prx-visually-hidden"> placed {order.placed_at ?? 'on an unrecorded date'}</span></a>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <nav className="prx-purchases__pagination" aria-label="Order history pages">
            {result.previous ? <a href={result.previous} rel="prev">Previous page</a> : <span />}
            <span aria-current="page">Page {page}{page <= result.meta.last_page ? ` of ${result.meta.last_page}` : ''}</span>
            {result.next ? <a href={result.next} rel="next">Next page</a> : <span />}
          </nav>
          <p className="prx-muted">{result.meta.total} {result.meta.total === 1 ? 'order' : 'orders'} in this history. Order totals do not confirm that a payment was collected.</p>
        </>
      )}
    </div>
  );
}
