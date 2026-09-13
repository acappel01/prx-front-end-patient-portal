'use client';

import { useState } from 'react';

/**
 * Enter the code from an authenticator app — or a recovery code.
 *
 * Posts to this app's `/api/session/two-factor`, which holds the challenge in an
 * httpOnly cookie; nothing here ever sees it. `one-time-code` lets the phone's
 * own autofill offer the code, and the numeric keypad opens on mobile.
 */
export default function TwoFactorCodeForm() {
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const value = new FormData(event.currentTarget).get('code');

    const response = await fetch('/api/session/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(useRecovery ? { recovery_code: value } : { code: value }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (response?.ok) {
      window.location.assign(payload?.data?.next ?? '/');

      return;
    }

    if (payload?.restart) {
      window.location.assign('/login');

      return;
    }

    setError(payload?.message ?? 'Something went wrong. Please try again.');
    setBusy(false);
  }

  async function backToSignIn() {
    await fetch('/api/session/two-factor', { method: 'DELETE' }).catch(() => null);
    window.location.assign('/login');
  }

  return (
    <form onSubmit={onSubmit} className="prx-card prx-form" key={useRecovery ? 'recovery' : 'totp'}>
      <h1 className="prx-form__title">{useRecovery ? 'Use a recovery code' : 'Enter your code'}</h1>
      <p className="prx-muted">
        {useRecovery
          ? 'Enter one of the recovery codes you saved when you set up two-step verification. Each works once.'
          : 'Open your authenticator app and enter the 6-digit code for this account.'}
      </p>

      <div className="prx-field">
        <label htmlFor="code">{useRecovery ? 'Recovery code' : 'Code'}</label>
        {useRecovery ? (
          <input id="code" name="code" type="text" maxLength={24} autoComplete="off" autoCapitalize="characters" spellCheck={false} required autoFocus />
        ) : (
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoComplete="one-time-code"
            required
            autoFocus
          />
        )}
      </div>

      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Checking…' : 'Continue'}
      </button>

      <p className="prx-form__links">
        <button type="button" className="prx-link" onClick={() => { setUseRecovery(!useRecovery); setError(null); }}>
          {useRecovery ? 'Use the code from your app instead' : 'Lost your phone? Use a recovery code'}
        </button>
      </p>
      <p className="prx-form__links">
        <button type="button" className="prx-link" onClick={backToSignIn}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
