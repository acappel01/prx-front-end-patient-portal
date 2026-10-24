import HealthRecordManager from '@/components/record/HealthRecordManager';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Record → Keep this accurate: medications, allergies and conditions. Data the
 * patient owns and that decays, so it lives under Maintain. Hidden, and
 * refused by the admin, when the install leaves these lists to the care team.
 */
export default function HealthRecordPage() {
  return (
    <>
      <BackLink />
      <Screen title="Medications, allergies and conditions" path="/patient/health-record" empty="" rowsOf={(data) => (data ? [data] : [])}>
        {(rows, data) => (
          <>
            <p className="prx-muted">Your provider checks these before prescribing. Keep them up to date, including anything you take without a prescription.</p>
            <HealthRecordManager record={data} />
          </>
        )}
      </Screen>
    </>
  );
}
