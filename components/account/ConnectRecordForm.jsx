'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

/**
 * Connect the medical record an order created.
 *
 * An account with no linked chart is a valid account with zero clinical
 * visibility — the normal state between signing up and finishing intake. It is
 * not an error, but it IS the one thing standing between this patient and the
 * entire product, so it gets an action rather than an empty screen.
 *
 * The order reference is the proof. It is the uuid from the intake URL, so the
 * usual arrival here is a link that fills it in; typing it is the fallback.
 * Everything that decides whether the claim is legitimate happens in the admin
 * (`LinkPatientToPrxChartAction`) — this component sends a reference and
 * renders the answer. It deliberately knows nothing about charts.
 */
export default function ConnectRecordForm({ initialReference = '' }) {
  const router = useRouter();
  const [reference, setReference] = useState(initialReference);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(event) {
    event.preventDefault();

    if (inFlight.current) return;

    const value = reference.trim();

    if (value === '') {
      setError('Enter the order reference from your confirmation.');

      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError(null);

    const response = await fetch('/api/portal/patient/link-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_uuid: value }),
    }).catch(() => null);

    if (response?.ok) {
      // Full navigation, not a soft push: the layout and Home both resolve the
      // link server-side, and a cached RSC payload taken a moment ago still
      // says this account has no record.
      router.refresh();
      window.location.assign('/');

      return;
    }

    const payload = await response?.json().catch(() => null);

    // The admin returns one deliberately uniform refusal for "no such
    // reference" and "that reference is not yours", so that a caller cannot
    // discover which order numbers exist. Show it as sent; do not try to
    // interpret it into something more specific.
    setError(
      payload?.errors?.lead_uuid?.[0] ??
        payload?.message ??
        'We could not connect that order. Please check the reference and try again.'
    );
    setBusy(false);
    inFlight.current = false;
  }

  return (
    <form className="prx-card prx-form" onSubmit={onSubmit} noValidate>
      <div className="prx-field">
        <label htmlFor="reference">Order reference</label>
        <input
          id="reference"
          name="reference"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'reference-error' : undefined}
        />
        {error ? (
          <p className="prx-field__error" id="reference-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Connecting…' : 'Connect my record'}
      </button>
    </form>
  );
}
