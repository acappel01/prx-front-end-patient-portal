import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Care — everything about the treatment currently running.
 *
 * Read-only for now. Approval and payment screens are deliberately held until
 * the remaining provider API gaps close; a control that is guaranteed to fail
 * is worse than an absent one.
 */
export default function CarePage() {
  return (
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
                {rx.status}
                {rx.refills != null ? ` · ${rx.refills} refills left` : ''}
                {rx.prescriber ? ` · ${rx.prescriber}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
