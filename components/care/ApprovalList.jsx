'use client';

import { useState } from 'react';

import Reference from '@/components/ui/Reference';
import { money } from '@/lib/format';
import { portalCall } from '@/lib/portalClient';

/**
 * Items the provider added after the visit, each approved or declined here.
 *
 * Approving charges the card the provider holds, so three rules apply:
 *
 * - **Confirm first, with the amount and the card.** The first tap only asks;
 *   the second charges. The total sent is the one shown, and the admin refuses
 *   a total that no longer matches (`price_mismatch`).
 * - **One idempotency key per attempt.** Minted when the patient confirms and
 *   reused if the same attempt is sent again, so a double tap or a resend
 *   replays the first outcome instead of charging twice.
 * - **Never offer a retry after an uncertain outcome.** A dropped connection
 *   or `uncertain` means money may have moved. The item shows as pending and
 *   the page stops offering the button until it is reloaded.
 */
export default function ApprovalList({ items, card }) {
  return (
    <ul className="prx-rows">
      {items.map((item) => (
        <ApprovalItem key={item.approval_id} item={item} card={card} />
      ))}
    </ul>
  );
}

function ApprovalItem({ item, card }) {
  const [stage, setStage] = useState('idle'); // idle | confirm | busy | done
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(null);

  const amount = money(item.amount_due, item.currency);
  const cardLabel = card ? `${capitalise(card.card_brand)} ending ${card.last_four}` : null;

  async function decide(decision) {
    // The same attempt keeps its key; a new decision after an answer gets a new one.
    const key = attempt ?? crypto.randomUUID();
    setAttempt(key);
    setStage('busy');

    const response = await portalCall(`/patient/approvals/${item.approval_id}/${decision}`, {
      method: 'POST',
      body: decision === 'accept' ? { acknowledged_total: item.amount_due, idempotency_key: key } : {},
    });

    const outcome = response.data?.outcome ?? response.code ?? (response.status === 0 ? 'uncertain' : 'error');

    setResult({
      outcome,
      message:
        response.data?.message ??
        response.message ??
        (outcome === 'uncertain'
          ? 'We could not confirm the payment. Please do not try again: we will check it and update this item.'
          : 'Something went wrong. Nothing was charged.'),
      reference: response.status >= 500 ? response.requestId : null,
    });

    // Only `error` (nothing charged) may be tried again, with a fresh key.
    if (outcome === 'error') {
      setAttempt(null);
      setStage('idle');

      return;
    }

    setStage('done');
  }

  return (
    <li className="prx-card prx-approval">
      <h2>{item.product_name}</h2>
      <dl className="prx-approval__price">
        {item.quantity > 1 ? <Row label="Quantity" value={item.quantity} /> : null}
        <Row label="Item" value={money(item.total_price, item.currency)} />
        {item.shipping ? <Row label="Shipping" value={money(item.shipping, item.currency)} /> : null}
        <Row label="Total if you approve" value={<strong>{amount}</strong>} />
      </dl>
      {item.review_expires_at ? (
        <p className="prx-row__meta">
          Decide by{' '}
          {new Date(item.review_expires_at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}. After that, your order
          ships without it.
        </p>
      ) : null}

      {result ? (
        <p className={result.outcome === 'charged' || result.outcome === 'declined' ? 'prx-approval__result' : 'prx-field__error'} role="status">
          {result.message}
        </p>
      ) : null}
      <Reference id={result?.reference ?? null} />

      {stage === 'idle' ? (
        <div className="prx-approval__actions">
          <button type="button" className="prx-task__cta prx-task__cta--primary" onClick={() => setStage('confirm')} disabled={!card}>
            Approve {amount}
          </button>
          <button type="button" className="prx-link" onClick={() => decide('decline')}>
            Decline
          </button>
          {!card ? <p className="prx-muted">There is no card on file to charge. <a href="/talk">Message your care team</a> to add one.</p> : null}
        </div>
      ) : null}

      {stage === 'confirm' ? (
        <div className="prx-approval__confirm" role="group" aria-label="Confirm the charge">
          <p>
            Charge <strong>{amount}</strong> to your {cardLabel}? It ships separately from your original order.
          </p>
          <div className="prx-approval__actions">
            <button type="button" className="prx-task__cta prx-task__cta--primary" onClick={() => decide('accept')}>
              Yes, charge {amount}
            </button>
            <button type="button" className="prx-link" onClick={() => setStage('idle')}>
              Go back
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'busy' ? <p className="prx-muted" role="status">Working on it. Please keep this page open.</p> : null}
    </li>
  );
}

function Row({ label, value }) {
  return (
    <div className="prx-row">
      <dt className="prx-row__meta">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function capitalise(value) {
  const text = String(value ?? 'Card');

  return text.charAt(0).toUpperCase() + text.slice(1);
}
