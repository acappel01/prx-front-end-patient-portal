import { notFound } from 'next/navigation';

import LabFlag from '@/components/labs/LabFlag';
import BackLink from '@/components/ui/BackLink';
import LocalTime from '@/components/ui/LocalTime';
import Screen from '@/components/ui/Screen';
import { formatValue, rangeText } from '@/lib/labs';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * One lab order: each test and its values, with the range and any note the
 * provider wrote for the patient. Before the results are released the admin
 * sends no values, and the page says where the order is instead.
 */
export default async function LabOrderPage({ params }) {
  const { id } = await params;

  if (!UUID.test(id)) notFound();

  return (
    <>
      <BackLink href="/health/labs" label="Lab results" />
      <Screen
        title="Your results"
        path={`/patient/labs/${id}`}
        rowsOf={(data) => (data?.order?.id ? [data.order] : [])}
        empty="We couldn't find this lab order."
      >
        {(rows, data) => <Order order={data.order} tests={data.tests ?? []} />}
      </Screen>
    </>
  );
}

function Order({ order, tests }) {
  return (
    <>
      <p className="prx-row__meta">
        {order.number ? `${order.number} · ` : ''}
        {order.stage_label}
      </p>

      {order.critical ? (
        <div className="prx-notice prx-notice--critical" role="alert">
          <strong>A value in this order is in the critical range.</strong> Your care team has been alerted and will review it with you. If
          you feel unwell now, call 911 or go to the nearest emergency room.
        </div>
      ) : null}

      {order.released && !order.reviewed ? (
        <p className="prx-notice">Not yet reviewed by your provider. These are the values as the lab reported them.</p>
      ) : null}

      {!order.released ? (
        <div className="prx-stack__clear">
          <p>Your results will show here once the lab sends them.</p>
        </div>
      ) : (
        tests.map((test, index) => (
          <section className="prx-card" key={`${test.name}-${index}`} aria-labelledby={`test-${index}`}>
            <h2 className="prx-section-title" id={`test-${index}`}>
              {test.name}
            </h2>
            <ul className="prx-rows">
              {test.results.map((result, resultIndex) => (
                <li className={`prx-lab-result prx-lab-result--${result.severity}`} key={`${result.name}-${resultIndex}`}>
                  <div className="prx-row">
                    <span>
                      <strong>{result.name}</strong>
                      <br />
                      <span className="prx-row__meta">{rangeText(result)}</span>
                    </span>
                    <span className="prx-lab__reading">
                      {formatValue(result)} <LabFlag severity={result.severity} direction={result.direction} />
                    </span>
                  </div>
                  {result.notes.map((note, noteIndex) => (
                    <blockquote className="prx-lab__note" key={noteIndex}>
                      <p>{note.note}</p>
                      <footer className="prx-row__meta">
                        {note.provider_name ?? 'Your provider'}
                        {note.at ? (
                          <>
                            {' · '}
                            <LocalTime value={note.at} format="date" />
                          </>
                        ) : null}
                      </footer>
                    </blockquote>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {order.results_at ? (
        <p className="prx-muted">
          Results received <LocalTime value={`${order.results_at}T12:00:00Z`} format="date" />.
        </p>
      ) : null}
    </>
  );
}
