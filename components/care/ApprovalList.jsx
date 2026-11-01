'use client';

import { useState } from 'react';

import Reference from '@/components/ui/Reference';
import { approvalOutcome } from '@/lib/approvalOutcome';
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
 *   replays the first outcome instead of charging twice. The key is also kept
 *   in this tab's sessionStorage until the attempt has a clear answer, so an
 *   approve after a reload replays the uncertain attempt rather than starting
 *   a new charge.
 * - **Retry only after `code: 'error'`**, the one answer where the admin knows
 *   nothing was charged; that retry gets a new key. Anything else unclear (a
 *   dropped connection, a 5xx or 504 without a code, an unknown code) is
 *   uncertain: money may have moved. The item shows as possibly processing,
 *   the key is kept, and no button is offered. `lib/approvalOutcome.js`
 *   decides which is which.
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
    // An accept keeps its key until it has a clear answer: this attempt's, or
    // one left uncertain before a reload. A decline charges nothing and needs none.
    const key = decision === 'accept' ? (attempt ?? storedKey(item.approval_id) ?? crypto.randomUUID()) : null;
    if (key) {
      setAttempt(key);
      storeKey(item.approval_id, key);
    }
    setStage('busy');

    const response = await portalCall(`/patient/approvals/${item.approval_id}/${decision}`, {
      method: 'POST',
      body: decision === 'accept' ? { acknowledged_total: item.amount_due, idempotency_key: key } : {},
    });

    const answer = approvalOutcome(response, decision);
    setResult(answer);

    // Uncertain: keep the key (state and storage), offer nothing.
    if (answer.uncertain) {
      setStage('done');

      return;
    }

    setAttempt(null);
    storeKey(item.approval_id, null);

    // Only `error` (nothing charged) may be tried again, with a fresh key.
    setStage(answer.retry ? 'idle' : 'done');
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

// sessionStorage can be missing or throw (private mode, blocked storage); the
// in-memory key still covers this page, so a failure here is only a lost replay.
const KEY_PREFIX = 'prx-approval-key:';

function storedKey(approvalId) {
  try {
    return window.sessionStorage.getItem(KEY_PREFIX + approvalId);
  } catch {
    return null;
  }
}

function storeKey(approvalId, key) {
  try {
    if (key) window.sessionStorage.setItem(KEY_PREFIX + approvalId, key);
    else window.sessionStorage.removeItem(KEY_PREFIX + approvalId);
  } catch {
    // See above.
  }
}

function capitalise(value) {
  const text = String(value ?? 'Card');

  return text.charAt(0).toUpperCase() + text.slice(1);
}
