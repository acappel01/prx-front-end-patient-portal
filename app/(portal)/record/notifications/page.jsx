import PreferencesForm from '@/components/record/PreferencesForm';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/** Record → Messages: which updates the patient gets, and how. */
export default function NotificationsPage() {
  return (
    <>
      <BackLink />
      <Screen title="Messages we send you" path="/patient/communication-preferences" empty="" rowsOf={(data) => (data ? [data] : [])}>
        {(rows, data) => <PreferencesForm initial={data} />}
      </Screen>
    </>
  );
}
