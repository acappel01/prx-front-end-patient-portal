'use client';

import { useEffect, useState } from 'react';

import LoginForm from '@/components/ui/LoginForm';

const RETRY_KEY = 'prx-claim-session-retry';
const RETRY_WINDOW_MS = 30_000;

/**
 * The sign-in step on a claim page — after one silent same-origin reload.
 *
 * WHY THE RELOAD. The session cookie is `SameSite=Strict`, and a browser does
 * not send a Strict cookie on a navigation that STARTED on another site. A
 * patient tapping the link in Gmail or Outlook therefore lands here looking
 * signed out even when they signed in a minute ago — measured on the first
 * live claim, 2026-09-12: a valid eight-minute-old session, and a second
 * sign-in demanded anyway.
 *
 * A navigation this page starts itself is same-site, so the cookie IS sent. So
 * the first render replaces the location once; a visitor who really is signed
 * out comes straight back here and gets the form. `Strict` is untouched —
 * relaxing it to `Lax` would fix this by sending the session on every
 * cross-site top-level navigation, which is the exposure `Strict` was chosen to
 * avoid.
 *
 * The retry is remembered for this tab only, for a few seconds, so it can never
 * loop. `replace` rather than `assign`, so Back does not return to the retry.
 * No token is read or moved: the URL is re-requested exactly as it is.
 */
export default function ClaimSignIn({ lede }) {
  const [phase, setPhase] = useState('checking');

  useEffect(() => {
    let recent = false;

    try {
      const at = Number(window.sessionStorage.getItem(RETRY_KEY));
      recent = at > 0 && Date.now() - at < RETRY_WINDOW_MS;

      if (recent) {
        window.sessionStorage.removeItem(RETRY_KEY);
      } else {
        window.sessionStorage.setItem(RETRY_KEY, String(Date.now()));
      }
    } catch {
      // Storage blocked (private mode, a strict webview): without a loop guard
      // do not retry at all. The form below still works.
      recent = true;
    }

    if (recent) {
      setPhase('form');
    } else {
      window.location.replace(window.location.href);
    }
  }, []);

  if (phase === 'checking') {
    return (
      <p className="prx-muted prx-lede" role="status">
        Checking your sign-in…
      </p>
    );
  }

  return (
    <>
      <h2>Connect your record</h2>
      <p className="prx-muted prx-lede">{lede}</p>
      <LoginForm stayOnPage />
    </>
  );
}
