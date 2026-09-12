'use client';

import { useState } from 'react';

/**
 * Sign out.
 *
 * `DELETE /api/session` revokes the admin token best-effort and clears the
 * cookie either way. The navigation afterwards is a full load, not a client
 * push, so no screen rendered under the old session survives in the router
 * cache — on a shared device that is the whole point of signing out.
 */
export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch('/api/session', { method: 'DELETE' }).catch(() => null);
    window.location.assign('/login');
  }

  return (
    <p className="prx-signout">
      <button type="button" className="prx-task__cta" onClick={signOut} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </p>
  );
}
