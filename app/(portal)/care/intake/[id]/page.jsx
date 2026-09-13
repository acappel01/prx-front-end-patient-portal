import { notFound, redirect } from 'next/navigation';

import ProvideInformationForm from '@/components/care/ProvideInformationForm';
import Reference from '@/components/ui/Reference';
import { adminFetch } from '@/lib/adminApi';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;

/**
 * What a held visit still needs from the patient — and a way to send it.
 *
 * Driven by the provider's own requirements for this visit
 * (`GET /patient/encounters/{id}/requirements`), with each item's wording from
 * the operator's settings where they wrote one. The form appears only while the
 * provider will accept it (`resolvable_via_api`): a visit held for any other
 * reason, or already with a clinician, shows what is outstanding and points to
 * the care team instead of offering a form that would be refused.
 */
export default async function IntakePage({ params, searchParams }) {
  const { id } = await params;
  const saved = (await searchParams)?.saved === '1';

  if (!UUID.test(id)) notFound();

  const { ok, status, data, code, requestId } = await adminFetch(`/patient/encounters/${id}/requirements`);

  if (status === 401) redirect('/login');
  if (status === 403 && code === 'two_factor_setup_required') redirect('/record/security?required=1');

  const allSatisfied = ok && (data?.items ?? []).every((item) => item.satisfied);
  // The provider writes its message once and never clears it, so it only means
  // "we are asking now" while the visit is actually held for information.
  const askingNow = ok && data?.status === 'requires_information' && Boolean(data?.info_request_message);

  // A provider can ask for more with only a message (a follow-up after review):
  // nothing is "missing", but the patient must see what was asked and how to
  // answer — never "nothing outstanding".
  if (allSatisfied && askingNow) {
    return (
      <>
        <h1>Your provider needs more information</h1>
        <p className="prx-task__body">{data.info_request_message}</p>
        <p>
          <a className="prx-task__cta" href="/talk">
            Message your care team
          </a>
        </p>
      </>
    );
  }

  if (status === 404 || allSatisfied) {
    // Finished, or never outstanding. Both are good news, not an error.
    return (
      <>
        <h1>Nothing outstanding</h1>
        <p className="prx-stack__clear">There is nothing left to send for this visit.</p>
        <p>
          <a href="/">Back to your care</a>
        </p>
      </>
    );
  }

  if (!ok) {
    return (
      <>
        <h1>What your visit needs</h1>
        <p className="prx-muted">We can&rsquo;t load this right now. Please try again in a moment.</p>
        {status >= 500 ? <Reference id={requestId} /> : null}
      </>
    );
  }

  const outstanding = data.items.filter((item) => !item.satisfied);

  return (
    <>
      <h1>What your visit needs</h1>
      {saved ? (
        <p className="prx-notice" role="status">
          Saved. Your visit still needs the items below.
        </p>
      ) : null}
      {askingNow ? <p className="prx-task__body">{data.info_request_message}</p> : null}

      {typeof data.completeness_pct === 'number' ? (
        <div
          className="prx-task__meter"
          role="progressbar"
          aria-valuenow={data.completeness_pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Intake completion"
        >
          <span style={{ width: `${data.completeness_pct}%` }} />
        </div>
      ) : null}

      {data.resolvable_via_api ? (
        <ProvideInformationForm encounterId={id} items={outstanding} />
      ) : (
        <section className="prx-card" aria-labelledby="with-team">
          <h2 id="with-team">Still needed</h2>
          <ul className="prx-rows">
            {outstanding.map((item) => (
              <li className="prx-row" key={item.slug}>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="prx-muted">
            Your care team will let you know how to send these. If you have them ready, send them a message.
          </p>
          <a className="prx-task__cta" href="/talk">
            Message your care team
          </a>
        </section>
      )}
    </>
  );
}
