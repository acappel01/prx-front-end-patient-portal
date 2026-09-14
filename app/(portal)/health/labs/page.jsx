import { notFound, redirect } from 'next/navigation';

import LabHistoryError from '@/components/health/LabHistoryError';
import LocalTime from '@/components/ui/LocalTime';
import { adminFetch, deploymentConfig } from '@/lib/adminApi';
import { LABS_PATH, labLabel, labPage, labsEnabled, loadLabHistory } from '@/lib/labHistory.mjs';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LabsPage({ searchParams }) {
  const token = await sessionToken();
  if (!token) redirect('/login');
  if (!labsEnabled(await deploymentConfig())) notFound();
  const page = labPage((await searchParams)?.page);
  const result = await loadLabHistory((path) => adminFetch(path, { token }), page);
  if (result.state === 'two-factor') redirect('/record/security?required=1');

  return (
    <div className="prx-labs">
      <p><a href="/health">Back to Health</a></p>
      <h1>Lab orders</h1>
      <p className="prx-muted">Lab order statuses and dates from your connected medical record. This read-only history does not include lab results or interpretation.</p>
      {result.state !== 'ready' ? <LabHistoryError result={result} /> : (
        <>
          {result.items.length === 0 ? (
            <div className="prx-stack__clear">
              <p>{page > 1 ? 'There are no lab orders on this page.' : 'No lab orders are available in your connected record yet.'}</p>
              {page > 1 ? <a href={LABS_PATH}>Go to the first page</a> : null}
            </div>
          ) : (
            <ul className="prx-rows" aria-label="Lab orders">
              {result.items.map((order) => (
                <li className="prx-card" key={order.id}>
                  <h2>{order.lab_order_number || 'Lab order'}</h2>
                  <p>Status: {labLabel(order.status, 'Status unavailable')}</p>
                  <dl className="prx-labs__facts">
                    <div><dt>Collection method</dt><dd>{labLabel(order.collection_method)}</dd></div>
                    {[
                      ['ordered_at', 'Ordered'], ['results_received_at', 'Results received'],
                      ['completed_at', 'Completed'], ['created_at', 'Recorded'],
                    ].map(([field, label]) => (
                      <div key={field}><dt>{label}</dt><dd>{order[field] ? <LocalTime value={order[field]} /> : 'Not recorded'}</dd></div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
          <nav className="prx-labs__pagination" aria-label="Lab history pages">
            {result.previous ? <a href={result.previous} rel="prev">Previous page</a> : <span />}
            <span aria-current="page">Page {page}{page <= result.pagination.last_page ? ` of ${result.pagination.last_page}` : ''}</span>
            {result.next ? <a href={result.next} rel="next">Next page</a> : <span />}
          </nav>
        </>
      )}
    </div>
  );
}
