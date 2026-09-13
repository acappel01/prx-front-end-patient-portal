'use client';

import { useRef, useState } from 'react';

const MIN_LENGTH = 8;

/**
 * Choose a password on an emailed-link page — creating the account
 * (`mode="create"`) or resetting it (`mode="reset"`).
 *
 * WHY A FORM AND NOT AN ACTION ON LOAD. Mail scanners open links before the
 * person does, and anything that spent the single-use token on page load would
 * spend it for the scanner. Loading the page changes nothing; submitting does.
 *
 * The token travels in the request body with `referrerPolicy: 'no-referrer'`.
 * The confirmation field is checked here only to catch a typo — the admin
 * decides everything else.
 */
export default function SetPasswordForm({ token, mode }) {
  const [error, setError] = useState(null);
  const [linkDead, setLinkDead] = useState(false);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const creating = mode === 'create';

  async function onSubmit(event) {
    event.preventDefault();

    if (inFlight.current) return;

    const form = new FormData(event.currentTarget);
    const password = form.get('password');

    if (password !== form.get('password_confirmation')) {
      setLinkDead(false);
      setError('The two passwords do not match.');

      return;
    }

    inFlight.current = true;
    setBusy(true);
    setError(null);

    const response = await fetch(creating ? '/api/account/create' : '/api/account/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({ token, password }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (response?.ok) {
      if (creating) {
        // Full navigation: the signed-in layout resolves the new session
        // server-side, and a soft push could render from a payload taken before
        // the cookie existed.
        window.location.assign('/');

        return;
      }

      setDone(payload?.message ?? 'Your password has been changed. Sign in with your new password.');

      return;
    }

    setError(payload?.message ?? 'Something went wrong. Please try again in a moment.');
    setLinkDead(response?.status === 422 && payload?.field === 'token');
    setBusy(false);
    inFlight.current = false;
  }

  if (done) {
    return (
      <div className="prx-card prx-form" role="status">
        <p>{done}</p>
        <p>
          <a className="prx-task__cta" href="/login">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="prx-card prx-form">
      <div className="prx-field">
        <label htmlFor="password">{creating ? 'Choose a password' : 'New password'}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          aria-describedby="password-hint"
          required
        />
      </div>

      <div className="prx-field">
        <label htmlFor="password_confirmation">Type it again</label>
        <input
          id="password_confirmation"
          name="password_confirmation"
          type="password"
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          aria-describedby="password-hint"
          required
        />
      </div>

      <p id="password-hint" className="prx-muted">
        At least {MIN_LENGTH} characters.
      </p>

      {error ? (
        <div role="alert">
          <p className="prx-field__error">{error}</p>
          {linkDead ? (
            <p>
              <a href={creating ? '/register' : '/forgot'}>Email me a new link</a>
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Saving…' : creating ? 'Create my account' : 'Set new password'}
      </button>
    </form>
  );
}
