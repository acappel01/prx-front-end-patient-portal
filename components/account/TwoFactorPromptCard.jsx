'use client';

import { useState } from 'react';

/**
 * The Home invitation's card, hidden through React state.
 *
 * "Not now" must not remove the node itself: React still owns it, and the next
 * soft navigation (a tab tap) would try to unmount a node that is gone, throw,
 * and take the whole screen to the error page. State hides it; the cookie keeps
 * it hidden on the next render.
 */
export default function TwoFactorPromptCard({ cookieName }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function dismiss() {
    document.cookie = `${cookieName}=dismissed; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Strict; Secure`;
    setDismissed(true);
  }

  return (
    <div className="prx-task">
      <h2 className="prx-task__title">Protect your account</h2>
      <p className="prx-task__body">
        Add two-step verification: a code from your phone after your password, so nobody can get in with your password alone.
        It takes about a minute.
      </p>
      <p className="prx-timeout__actions">
        <a className="prx-task__cta" href="/record/security">
          Set it up
        </a>
        <button type="button" className="prx-timeout__secondary" onClick={dismiss}>
          Not now
        </button>
      </p>
    </div>
  );
}
