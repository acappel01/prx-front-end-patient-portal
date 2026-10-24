import ApprovalsNotice from '@/components/care/ApprovalsNotice';
import Screen from '@/components/ui/Screen';
import { humanize } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Care — everything about the treatment currently running.
 *
 * Items the provider added after the visit are decided under Care → Approvals;
 * the notice above the prescriptions says when any are waiting.
 */
export default function CarePage() {
  return (
    <>
      <ApprovalsNotice />
      <Screen
        title="Your care"
        path="/patient/prescriptions"
        empty="Nothing is prescribed yet."
        emptyAction={{ href: '/talk', label: 'Talk to a provider' }}
      >
        {(rows) => (
          <ul className="prx-rows">
            {rows.map((rx) => (
              <li className="prx-card" key={rx.id}>
                {/* Lead with the answer. The dose is what the patient opened this
                    screen for, and it lives at items[].sig — a prescription can
                    carry several items, and the sig is per item, never on the
                    prescription. Safety copy is accessible, never on top. */}
                {(rx.items ?? []).map((item, index) => (
                  <div key={`${rx.id}-${index}`}>
                    <h2>{item.product_name}</h2>
                    <p className="prx-task__body">{item.sig}</p>
                    {item.patient_instructions ? (
                      <p className="prx-row__meta">{item.patient_instructions}</p>
                    ) : null}
                  </div>
                ))}
                <p className="prx-row__meta">
                  {humanize(rx.status)}
                  {rx.refills != null ? ` · ${rx.refills} refills left` : ''}
                  {rx.prescriber ? ` · ${rx.prescriber}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Screen>
    </>
  );
}
