'use client';

import { useRef, useState } from 'react';

/**
 * Ask for an emailed link — to create an account (`intent="register"`) or to
 * reset a password (`intent="forgot"`).
 *
 * THE SUCCESS SCREEN SAYS ONE THING. The admin answers the same 202 whether the
 * address has an account, an order, or nothing, and sends a different link (or
 * none) accordingly. So this screen must not guess either: it shows the admin's
 * sentence, and never "we found your account" or "no account with that email".
 * Telling those apart would tell anyone whether a named person is a patient.
 */
export default function EmailLinkForm({ intent, submitLabel }) {
  const [state, setState] = useState({ phase: 'idle', message: null });
  const inFlight = useRef(false);

  async function onSubmit(event) {
    event.preventDefault();

    if (inFlight.current) return;

    inFlight.current = true;
    setState({ phase: 'sending', message: null });

    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/account/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent, email: form.get('email') }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    inFlight.current = false;

    if (response?.status === 202) {
      setState({ phase: 'sent', message: payload?.message ?? null });

      return;
    }

    setState({
      phase: 'failed',
      message: payload?.message ?? 'We could not send the email. Please try again in a moment.',
    });
  }

  if (state.phase === 'sent') {
    return (
      <div className="prx-card prx-form" role="status">
        <p>{state.message ?? 'Check your email for a link.'}</p>
        <p className="prx-muted">
          The link works once and expires after an hour. Nothing arrived? Check your spam folder, or make sure you used the
          address you ordered with.
        </p>
        <p>
          <a href="/login">Back to sign in</a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="prx-card prx-form">
      <div className="prx-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>

      {state.phase === 'failed' ? (
        <p className="prx-field__error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={state.phase === 'sending'}>
        {state.phase === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
