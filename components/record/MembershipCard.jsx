'use client';

import { useEffect, useRef, useState } from 'react';

import PaymentFields from '@/components/payments/PaymentFields';
import LocalTime from '@/components/ui/LocalTime';
import { money } from '@/lib/format';
import { documentAllowsPayment } from '@/lib/paymentPage';
import { portalCall } from '@/lib/portalClient';

/** `?update=<uuid>`: open this membership's card form once the page has reloaded under the payment policy. */
const UPDATE_PARAM = 'update';

/** What a card change did to a renewal that was due (the admin's `meta.renewal`). */
function renewalNote(renewal) {
  if (renewal === 'renewed') return 'Your card is updated, and the payment that was due went through.';
  if (renewal === 'failed') return 'Your card is updated, but the payment that was due was declined. We’ll try it again on the date below.';
  if (renewal === 'lapsed') return 'Your card is updated, but the payment that was due was declined and the membership has ended.';

  return 'Your card is updated. Future payments use it.';
}

/**
 * One membership: what it costs, when it renews or ends, and Cancel or Undo.
 *
 * WHAT CANCEL MEANS comes from the admin, not from here: a paid-up membership
 * stays active to the end of the period already paid for; one that is past due
 * ends at once (there is no paid period left to keep). The confirm step says
 * which, and that a founding rate does not come back, before anything is sent.
 * Whether either button shows is the admin's `can_cancel` / `can_resume`.
 *
 * UPDATE CARD (`can_update_card`) opens the gateway's own card fields
 * (components/payments, the storefront join's), and only the token goes to
 * the admin. A payment that is past due is charged on the new card at once;
 * the admin says how that went (`meta.renewal`). The gateway SDK needs this
 * document to have been served under the payment policy, so when it was not
 * (the patient arrived by a client-side navigation) the page reloads first
 * and reopens the form (`?update=`).
 */
export default function MembershipCard({ initial }) {
  const [membership, setMembership] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState(null);
  const paymentRef = useRef(null);

  const price = `${money(membership.price)}${membership.billing_period?.suffix ?? ''}`;
  const pastDue = membership.past_due;
  const card = membership.card;

  // Back from the reload that switched on the payment policy: open the form.
  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get(UPDATE_PARAM) !== initial.uuid) return;

    url.searchParams.delete(UPDATE_PARAM);
    window.history.replaceState(null, '', url);

    if (initial.can_update_card && documentAllowsPayment()) setUpdating(true);
  }, [initial.uuid, initial.can_update_card]);

  function openUpdate() {
    setError(null);
    setNotice(null);

    if (!documentAllowsPayment()) {
      const url = new URL(window.location.href);
      url.searchParams.set(UPDATE_PARAM, membership.uuid);
      window.location.assign(url);

      return;
    }

    setConfirming(false);
    setUpdating(true);
  }

  async function saveCard() {
    if (busy) return;
    setBusy(true);
    setError(null);

    let payment;
    try {
      payment = await paymentRef.current?.tokenize();
    } catch (failure) {
      setBusy(false);
      setError(failure?.message ?? 'We couldn’t check that card. Please try again.');

      return;
    }

    if (!payment) {
      setBusy(false);

      return;
    }

    const result = await portalCall(`/patient/memberships/${membership.uuid}/card`, { method: 'POST', body: { payment_method: payment } });

    setBusy(false);

    if (result.status === 401) return;

    if (!result.ok || !result.data) {
      setError(result.message ?? 'We couldn’t update your card. Please try again.');

      return;
    }

    setUpdating(false);
    setMembership(result.data);
    setNotice(renewalNote(/** @type {{ renewal?: string | null } | null} */ (result.meta)?.renewal));
  }

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
              {card.exp_month && card.exp_year ? ` · Expires ${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}` : ''}
            </span>
          </li>
        ) : null}
      </ul>

      {notice ? (
        <p className="prx-membership__notice prx-membership__notice--ok" role="status">
          {notice}
        </p>
      ) : null}

      {/* A past-due notice below already asks for a new card. */}
      {card && !pastDue && (card.expired || card.expiring) ? (
        <p className="prx-membership__notice" role="status">
          {card.expired
            ? 'The card on file has expired. Update it so your next payment goes through.'
            : 'The card on file expires before your next payment. Update it so the payment goes through.'}
        </p>
      ) : null}

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
          {membership.can_update_card ? ' Updating your card retries the payment straight away.' : null}
        </p>
      ) : null}

      {updating ? (
        <div className="prx-membership__confirm" role="group" aria-label="Update card">
          <p>{pastDue ? 'Enter the new card. We’ll take the payment that’s due on it straight away.' : 'Enter the new card. Nothing is charged now; your next payment uses it.'}</p>
          <PaymentFields configPath={`/patient/memberships/${membership.uuid}/gateway-config`} ref={paymentRef} />
          <p className="prx-membership__actions">
            <button type="button" className="prx-task__cta prx-task__cta--primary" disabled={busy} onClick={saveCard}>
              {busy ? 'One moment…' : pastDue ? 'Save card and pay' : 'Save card'}
            </button>
            <button type="button" className="prx-link" disabled={busy} onClick={() => setUpdating(false)}>
              Keep the current card
            </button>
          </p>
        </div>
      ) : confirming ? (
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
      ) : membership.can_cancel || membership.can_resume || membership.can_update_card ? (
        <p className="prx-membership__actions">
          {membership.can_update_card ? (
            <button type="button" className="prx-link" disabled={busy} onClick={openUpdate}>
              Update card
            </button>
          ) : null}
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
