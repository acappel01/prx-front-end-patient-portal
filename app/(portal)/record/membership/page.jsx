import MembershipCard from '@/components/record/MembershipCard';
import BackLink from '@/components/ui/BackLink';
import Screen from '@/components/ui/Screen';

export const dynamic = 'force-dynamic';

/**
 * Record → Membership: what the patient pays for, when it renews, and the way
 * to stop it.
 *
 * Cancelling has to be as easy to find as joining was (auto-renewal law), so
 * this screen is never a portal module and never behind two-step verification;
 * the admin enforces both.
 */
export default function MembershipPage() {
  return (
    <>
      <BackLink />
      <Screen title="Your membership" path="/patient/memberships" empty="You don’t have a membership.">
        {(rows) => (
          <div className="prx-memberships">
            {rows.map((membership) => (
              <MembershipCard initial={membership} key={membership.uuid} />
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}
