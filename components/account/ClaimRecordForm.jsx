'use client';

import { useRef, useState } from 'react';

/**
 * Use a claim link: one button, one POST.
 *
 * WHY A BUTTON AND NOT AN AUTOMATIC CLAIM ON LOAD. Mail scanners — Outlook Safe
 * Links, corporate gateways, Gmail's prefetch — open links before the person
 * does. Anything that spent the single-use token on page load would spend it
 * for the scanner, and the patient would open a dead link. Loading this page
 * changes nothing; pressing the button does.
 *
 * The token travels in the request body with `referrerPolicy: 'no-referrer'`,
 * so it is not repeated in a Referer header on the way out. Every decision is
 * the admin's (`ClaimPatientRecordAction`); this renders the answer.
 */
export default function ClaimRecordForm({ token }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onClaim() {
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);
    setError(null);

    const response = await fetch('/api/portal/patient/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({ token }),
    }).catch(() => null);

    if (response?.ok) {
      // Full navigation, not a soft push: Home resolves the link server-side
      // and a cached RSC payload from a moment ago still says "not connected".
      window.location.assign('/');

      return;
    }

    if (response?.status === 401) {
      // The session ended between rendering and pressing. Re-render this page,
      // which asks them to sign in and keeps the link usable.
      window.location.reload();

      return;
    }

    const payload = await response?.json().catch(() => null);

    // The admin gives one sentence for unknown, used, expired and not-yours,
    // on purpose. Show it as sent; do not try to interpret it.
    setError(
      payload?.errors?.token?.[0] ??
        payload?.message ??
        'We could not connect your record. Please try again in a moment.'
    );
    setBusy(false);
    inFlight.current = false;
  }

  return (
    <div className="prx-card prx-form">
      {error ? (
        <div role="alert">
          <p className="prx-field__error">{error}</p>
          <p>
            <a href="/connect">Request a new link</a>
          </p>
        </div>
      ) : null}

      <button type="button" className="prx-task__cta prx-form__submit" onClick={onClaim} disabled={busy}>
        {busy ? 'Connecting…' : 'Connect my record'}
      </button>
    </div>
  );
}
