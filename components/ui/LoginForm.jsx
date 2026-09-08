'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Sign in.
 *
 * Posts to this app's own /api/session, which exchanges the credential for an
 * admin-issued token server-side and returns only a Set-Cookie. No token, no
 * chart id and no clinical value ever reaches this component.
 */
export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = await response?.json().catch(() => null);

      setError(payload?.message ?? 'Something went wrong. Please try again.');
      setBusy(false);

      return;
    }

    // Full navigation rather than a client push: the authenticated layout
    // resolves the session server-side, and a soft push can render it from a
    // cached RSC payload taken before the cookie existed.
    router.refresh();
    window.location.assign('/');
  }

  return (
    <form onSubmit={onSubmit} className="prx-card">
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />

      {/* Announced, not merely rendered — a sighted user sees the message
          appear, and a screen-reader user has to be told. */}
      {error ? (
        <p role="alert" style={{ color: 'var(--prx-urgent)' }}>
          {error}
        </p>
      ) : null}

      <button type="submit" className="prx-task__cta" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
