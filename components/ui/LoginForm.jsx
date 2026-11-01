'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Reference from '@/components/ui/Reference';
import { apiCall } from '@/lib/portalClient';

/**
 * Sign in.
 *
 * Posts to this app's own /api/session, which exchanges the credential for an
 * admin-issued token server-side and returns only a Set-Cookie. No token, no
 * chart id and no clinical value ever reaches this component.
 */
export default function LoginForm({ stayOnPage = false }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  // The admin's Reference when it could not sign anyone in (an outage, not a bad password).
  const [reference, setReference] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReference(null);

    const form = new FormData(event.currentTarget);

    // Anonymous: a 401 here is "those details did not match", shown below.
    const response = await apiCall('/api/session', {
      method: 'POST',
      body: { email: form.get('email'), password: form.get('password') },
      signedIn: false,
    });

    if (!response.ok) {
      setError(response.message ?? 'Something went wrong. Please try again.');
      setReference(response.requestId);
      setBusy(false);

      return;
    }

    // Two-step verification: the challenge is already in an httpOnly cookie.
    if (response.data?.two_factor) {
      window.location.assign('/login/verify');

      return;
    }

    // Full navigation rather than a client push: the authenticated layout
    // resolves the session server-side, and a soft push can render it from a
    // cached RSC payload taken before the cookie existed.
    //
    // `stayOnPage` re-renders the current URL signed in, for a screen that asks
    // for a session partway through (a claim link). It deliberately does NOT
    // take a return URL: that page's URL carries a token, and a `?next=` would
    // copy it into a second URL for no gain.
    router.refresh();

    if (stayOnPage) {
      window.location.reload();
    } else {
      window.location.assign(response.data?.next ?? '/');
    }
  }

  return (
    <form onSubmit={onSubmit} className="prx-card prx-form">
      {/* `prx-field` rather than a bare label/input pair: without it a label
          and its input are both inline boxes, so at 390px this rendered as
          "Email[box]Password" with the password field beside the button. It
          was the first screen every patient sees. */}
      <div className="prx-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>

      <div className="prx-field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {/* Announced, not merely rendered — a sighted user sees the message
          appear, and a screen-reader user has to be told. */}
      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Reference id={reference} />

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
