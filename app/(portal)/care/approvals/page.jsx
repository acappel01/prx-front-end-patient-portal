import ApprovalList from '@/components/care/ApprovalList';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Care → Approvals: items the provider added after the visit. Nothing is
 * charged until the patient approves one; see ApprovalList for the rules.
 */
export default function ApprovalsPage() {
  return (
    <>
      <BackLink href="/care" label="Your care" />
      <Screen
        title="Approve what your provider added"
        path="/patient/approvals"
        empty="Nothing is waiting for your approval."
        emptyAction={{ href: '/care', label: 'Back to your care' }}
      >
        {(rows, data) => (
          <>
            <p className="prx-muted">
              Your provider added {rows.length === 1 ? 'this item' : 'these items'} after your visit. Nothing is charged until you approve, and
              anything you decline is not sent.
            </p>
            <ApprovalList items={rows} card={data?.card ?? null} />
          </>
        )}
      </Screen>
    </>
  );
}
