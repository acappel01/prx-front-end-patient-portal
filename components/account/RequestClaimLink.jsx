'use client';

import { useRef, useState } from 'react';

/**
 * Ask the admin to email a link that connects this account's record.
 *
 * There is nothing to type. The admin finds the order from the signed-in
 * account and sends the link to the address that ORDER was placed under —
 * receiving it is the proof, which an order reference typed into a box never
 * was (an order uuid rides in URLs and can leak; a mailbox cannot).
 *
 * The success sentence comes from the admin and is the same whether or not an
 * order matched, so this screen must not infer anything from a 202 either:
 * "check your inbox" is all it may say.
 */
export default function RequestClaimLink() {
  const [state, setState] = useState({ phase: 'idle', message: null });
  const inFlight = useRef(false);

  async function onRequest() {
    if (inFlight.current) return;

    inFlight.current = true;
    setState({ phase: 'sending', message: null });

    const response = await fetch('/api/portal/patient/claim-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    inFlight.current = false;

    if (response?.status === 202) {
      setState({ phase: 'sent', message: payload?.message ?? null });

      return;
    }

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    setState({
      phase: 'failed',
      message:
        response?.status === 429
          ? 'You have asked for several links recently. Check your inbox, or try again later.'
          : (payload?.message ?? 'We could not send the link. Please try again in a moment.'),
    });
  }

  if (state.phase === 'sent') {
    return (
      <div className="prx-card prx-form" role="status">
        <h2 className="prx-task__title">Check your inbox</h2>
        {state.message ? <p>{state.message}</p> : null}
        <p className="prx-muted">
          Open the link while you are signed in to this account. It works once and expires after an
          hour. Nothing arriving? Check spam, then ask again.
        </p>
      </div>
    );
  }

  return (
    <div className="prx-card prx-form">
      {state.phase === 'failed' ? (
        <p className="prx-field__error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="button"
        className="prx-task__cta prx-form__submit"
        onClick={onRequest}
        disabled={state.phase === 'sending'}
      >
        {state.phase === 'sending' ? 'Sending…' : 'Email me a link'}
      </button>
    </div>
  );
}
