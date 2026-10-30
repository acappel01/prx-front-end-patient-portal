'use client';

import { useState } from 'react';

import LocalTime from '@/components/ui/LocalTime';
import { money } from '@/lib/format';
import { portalCall } from '@/lib/portalClient';

/**
 * One membership: what it costs, when it renews or ends, and Cancel or Undo.
 *
 * WHAT CANCEL MEANS comes from the admin, not from here: a paid-up membership
 * stays active to the end of the period already paid for; one that is past due
 * ends at once (there is no paid period left to keep). The confirm step says
 * which, and that a founding rate does not come back, before anything is sent.
 * Whether either button shows is the admin's `can_cancel` / `can_resume`.
 */
export default function MembershipCard({ initial }) {
  const [membership, setMembership] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const price = `${money(membership.price)}${membership.billing_period?.suffix ?? ''}`;
  const pastDue = membership.past_due;
  const card = membership.card;

  async function send(verb) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await portalCall(`/patient/memberships/${membership.uuid}/${verb}`, { method: 'POST', body: {} });

    setBusy(false);

    if (result.status === 401) return;

    if (!result.ok || !result.data) {
      setError(result.message ?? 'We couldn’t do that. Please try again.');

      return;
    }

    setConfirming(false);
    setMembership(result.data);
  }

  return (
    <section className="prx-card prx-membership" aria-labelledby={`prx-membership-${membership.uuid}`}>
      <h2 id={`prx-membership-${membership.uuid}`}>{membership.plan?.name ?? 'Membership'}</h2>
      <p className="prx-row__meta">
        {membership.status?.label}
        {membership.is_founding ? ' · Founding rate' : ''}
        {membership.cancel_at_period_end ? ' · Won’t renew' : ''}
      </p>

      <ul className="prx-rows">
        <li className="prx-row">
          <span>Price</span>
          <span>{price}</span>
        </li>
        {/* While a payment is past due the notice below says when it is tried again. */}
        {membership.renews_at && !pastDue ? (
          <li className="prx-row">
            <span>Next payment</span>
            <LocalTime value={membership.renews_at} format="date" />
          </li>
        ) : null}
        {membership.ends_at ? (
          <li className="prx-row">
            <span>{membership.cancel_at_period_end ? 'Active until' : 'Ended'}</span>
            <LocalTime value={membership.ends_at} format="date" />
          </li>
        ) : null}
        {card ? (
          <li className="prx-row">
            <span>Card</span>
            <span>
              {card.brand ?? 'Card'} ending {card.last_four}
            </span>
          </li>
        ) : null}
      </ul>

      {pastDue ? (
        <p className="prx-membership__notice" role="status">
          Your last payment didn’t go through.
          {pastDue.next_attempt_at ? (
            <>
              {' '}
              We’ll try again on <LocalTime value={pastDue.next_attempt_at} format="date" />.
            </>
          ) : null}
          {pastDue.grace_ends_at ? (
            <>
              {' '}
              If it still fails by <LocalTime value={pastDue.grace_ends_at} format="date" />, the membership ends.
            </>
          ) : null}
        </p>
      ) : null}

      {confirming ? (
        <div className="prx-membership__confirm" role="group" aria-label="Confirm cancelling">
          <p>
            {pastDue
              ? 'Your membership ends now, and the payment we couldn’t take won’t be tried again.'
              : 'You won’t be charged again. Your membership stays active until the end of the period you’ve paid for.'}
            {membership.is_founding ? ' Your founding rate can’t be restored if you join again later.' : ''}
          </p>
          <p className="prx-membership__actions">
            <button type="button" className="prx-task__cta prx-task__cta--primary" disabled={busy} onClick={() => send('cancel')}>
              {busy ? 'One moment…' : 'Cancel membership'}
            </button>
            <button type="button" className="prx-link" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </p>
        </div>
      ) : membership.can_cancel || membership.can_resume ? (
        <p className="prx-membership__actions">
          {membership.can_cancel ? (
            <button type="button" className="prx-link" disabled={busy} onClick={() => setConfirming(true)}>
              Cancel membership
            </button>
          ) : null}
          {membership.can_resume ? (
            <button type="button" className="prx-task__cta prx-task__cta--primary" disabled={busy} onClick={() => send('resume')}>
              {busy ? 'One moment…' : 'Keep my membership'}
            </button>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
