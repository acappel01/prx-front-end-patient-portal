'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Warns before an idle session ends, and ends it cleanly when it does.
 *
 * The admin is the authority: a patient session expires there after the
 * install's idle limit (`config.portal.session.idle_minutes`, default 30) and
 * cap. This component only mirrors the idle clock so the patient is not
 * surprised by it — and so a half-written message is not lost to a 401.
 *
 * WHAT COUNTS AS USE. Server-side, only a request carrying the session resets
 * the clock, and this component only believes a request it made or saw answered.
 * A navigation is NOT assumed to be one: some screens (`/connect`, `/health/log`)
 * render without calling the admin, and back/forward is served from the router
 * cache. So a navigation, a tap or a keypress sends a quiet keep-alive
 * (`GET /api/session`) whenever the admin has not heard from this tab for
 * KEEPALIVE_MS — a patient opening a form and composing a long message is not
 * idle. The portal clock only moves when that keep-alive succeeds, so the
 * warning can come early (a server render the tab didn't see) but never late.
 *
 * Timers are not trusted on mobile, where a backgrounded tab's timers are
 * frozen; elapsed time is recomputed from wall-clock timestamps whenever the tab
 * becomes visible.
 */

const WARN_BEFORE_MS = 2 * 60 * 1000;
const KEEPALIVE_MS = 5 * 60 * 1000;
const TICK_MS = 15 * 1000;

export default function SessionTimeout({ idleMinutes }) {
  const idleMs = Number(idleMinutes) > 0 ? Number(idleMinutes) * 60 * 1000 : null;
  const pathname = usePathname();
  const lastServerUse = useRef(Date.now());
  const keepAliveInFlight = useRef(false);
  const ending = useRef(false);
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [unreachable, setUnreachable] = useState(false);
  const stayButton = useRef(null);
  const dialog = useRef(null);

  // `expired` only when the clock ran out: the sign-in page's notice says the
  // patient was signed out for inactivity, which is wrong after a deliberate tap.
  const endSession = useCallback(async ({ expired = true } = {}) => {
    if (ending.current) return;
    ending.current = true;

    // Clears the cookie; the admin token is already gone or about to be.
    await fetch('/api/session', { method: 'DELETE' }).catch(() => null);
    window.location.assign(expired ? '/login?expired=1' : '/login');
  }, []);

  const keepAlive = useCallback(async () => {
    if (keepAliveInFlight.current) return false;
    keepAliveInFlight.current = true;

    const response = await fetch('/api/session', { cache: 'no-store' }).catch(() => null);
    keepAliveInFlight.current = false;

    if (response?.status === 401) {
      await endSession();

      return false;
    }

    if (response?.ok) {
      lastServerUse.current = Date.now();
      setWarning(false);
      setUnreachable(false);
    } else {
      // Network or 5xx: the session may still be alive, but this tab cannot
      // confirm it. Say so rather than let the countdown run out silently.
      setUnreachable(true);
    }

    return Boolean(response?.ok);
  }, [endSession]);

  // A navigation is activity, but not proof the admin saw a request — see above.
  useEffect(() => {
    if (Date.now() - lastServerUse.current >= KEEPALIVE_MS) keepAlive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!idleMs) return undefined;

    function check() {
      const now = Date.now();
      const remaining = lastServerUse.current + idleMs - now;

      if (remaining <= 0) {
        endSession();

        return;
      }

      if (remaining <= WARN_BEFORE_MS) {
        setSecondsLeft(Math.ceil(remaining / 1000));
        setWarning(true);
      }
    }

    // The patient is here. If the admin has not heard from this session for a
    // while, tell it now — at the moment of the activity, so the session is
    // never extended past the patient's real last touch. Not while the warning
    // is up: there, only the explicit choice counts.
    function onInteraction() {
      if (!warning && Date.now() - lastServerUse.current >= KEEPALIVE_MS) keepAlive();
    }

    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }

    const timer = window.setInterval(check, warning ? 1000 : TICK_MS);
    window.addEventListener('keydown', onInteraction, { passive: true });
    window.addEventListener('pointerdown', onInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('pointerdown', onInteraction);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [idleMs, warning, keepAlive, endSession]);

  // While the warning is up: focus starts on "Stay signed in", Tab stays inside
  // the dialog, and Escape means stay — dismissing a "still there?" is an answer.
  useEffect(() => {
    if (!warning) return undefined;

    stayButton.current?.focus();

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        keepAlive();

        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = dialog.current?.querySelectorAll('button') ?? [];
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [warning, keepAlive]);

  if (!warning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div ref={dialog} className="prx-timeout" role="alertdialog" aria-modal="true" aria-labelledby="prx-timeout-title" aria-describedby="prx-timeout-body">
      <div className="prx-timeout__panel">
        <h2 id="prx-timeout-title">Still there?</h2>
        {/* The countdown is not a live region: announcing every second would
            drown a screen reader. The dialog is announced once on opening. */}
        <p id="prx-timeout-body" className="prx-muted">
          For your security you&rsquo;ll be signed out in{' '}
          <span aria-hidden="true">
            {minutes}:{seconds}
          </span>
          <span className="prx-visually-hidden">less than two minutes</span>.
        </p>
        {unreachable ? (
          <p className="prx-timeout__error" role="alert">
            We couldn&rsquo;t reach the server. Check your connection and try again.
          </p>
        ) : null}
        <p className="prx-timeout__actions">
          <button ref={stayButton} type="button" className="prx-task__cta" onClick={keepAlive}>
            Stay signed in
          </button>
          <button type="button" className="prx-timeout__secondary" onClick={() => endSession({ expired: false })}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
