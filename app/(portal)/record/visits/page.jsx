import LocalTime from '@/components/ui/LocalTime';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';
import { humanize } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * Record → Past visits: Reference, read and shared, newest first. Keyed by the
 * visit number, never an internal id.
 */
export default function VisitsPage() {
  return (
    <>
      <BackLink />
      <Screen title="Your visits" path="/patient/encounters?per_page=50" empty="No visits yet." emptyAction={{ href: '/talk', label: 'Talk to a provider' }}>
        {(rows) => (
          <ul className="prx-rows">
            {rows.map((visit) => (
              <li className="prx-row" key={visit.id}>
                <span>
                  <strong>{visit.reason_for_visit || visit.chief_complaint || 'Consultation'}</strong>
                  <br />
                  <span className="prx-row__meta">
                    {visit.encounter_number}
                    {visit.completed_at || visit.scheduled_at || visit.created_at ? (
                      <>
                        {' · '}
                        <LocalTime value={visit.completed_at || visit.scheduled_at || visit.created_at} format="date" />
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="prx-row__meta">{humanize(visit.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </Screen>
    </>
  );
}
