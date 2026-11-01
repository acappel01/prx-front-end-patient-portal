'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deadlinesFrom, sessionPhase } from '@/lib/sessionClock';

/**
 * Warns before a session ends, and ends it cleanly when it does.
 *
 * The admin is the authority: a patient session expires there after the
 * install's idle limit (default 30 minutes) or its absolute cap (default 12
 * hours), whichever comes first. Every keep-alive (`GET /api/session`) answers
 * with both deadlines, `idle_expires_at` and `expires_at`, and this component
 * counts down to the earlier one (lib/sessionClock.js) — so a half-written
 * message is not lost to a 401 at either limit. It reads the deadlines from the
 * session itself, never from `/config`: one keep-alive on mount learns them.
 *
 * Near the idle limit it asks "Still there?" and "Stay signed in" pushes the
 * limit back. Near the absolute cap nothing can, so it says the session is
 * about to end and to save what they are writing; "Continue" only dismisses it.
 *
 * WHAT COUNTS AS USE. Server-side, only a request carrying the session resets
 * the idle clock, and this component only believes a request it made or saw answered.
 * A navigation is NOT assumed to be one: some screens (`/connect`, `/health/log`)
 * render without calling the admin, and back/forward is served from the router
 * cache. So a navigation, a tap or a keypress sends a quiet keep-alive
 * whenever the admin has not heard from this tab for KEEPALIVE_MS — a patient
 * opening a form and composing a long message is not idle. The idle deadline
 * only moves when that keep-alive succeeds, so the warning can come early (a
 * server render the tab didn't see) but never late.
 *
 * Timers are not trusted on mobile, where a backgrounded tab's timers are
 * frozen; the phase is recomputed from wall-clock time whenever the tab
 * becomes visible.
 */

const KEEPALIVE_MS = 5 * 60 * 1000;
// Without deadlines yet (the first keep-alive failed), activity retries this often.
const RETRY_UNKNOWN_MS = 60 * 1000;
const TICK_MS = 15 * 1000;

export default function SessionTimeout() {
  const pathname = usePathname();
  const deadlines = useRef(null);
  const lastServerUse = useRef(Date.now());
  const lastAttempt = useRef(0);
  const keepAliveInFlight = useRef(false);
  const capDismissed = useRef(false);
  const ending = useRef(false);
  // null, 'idle' or 'absolute': which limit the dialog is warning about.
  const [warning, setWarning] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [unreachable, setUnreachable] = useState(false);
  const stayButton = useRef(null);
  const dialog = useRef(null);

  // `expired` only when a limit ran out: the sign-in page then says why the
  // patient was signed out, which is wrong after a deliberate tap.
  const endSession = useCallback(async ({ expired = 'idle' } = {}) => {
    if (ending.current) return;
    ending.current = true;

    // Clears the cookie; the admin token is already gone or about to be.
    await fetch('/api/session', { method: 'DELETE' }).catch(() => null);
    window.location.assign(expired === 'absolute' ? '/login?expired=limit' : expired ? '/login?expired=1' : '/login');
  }, []);

  const check = useCallback(() => {
    const { phase, reason, remainingMs } = sessionPhase(deadlines.current, Date.now());

    if (phase === 'ended') {
      endSession({ expired: reason });

      return;
    }

    if (phase === 'warn' && !(reason === 'absolute' && capDismissed.current)) {
      setSecondsLeft(Math.ceil(remainingMs / 1000));
      setWarning(reason);

      return;
    }

    setWarning(null);
  }, [endSession]);

  const keepAlive = useCallback(async () => {
    if (keepAliveInFlight.current) return false;
    keepAliveInFlight.current = true;
    lastAttempt.current = Date.now();

    const response = await fetch('/api/session', { cache: 'no-store' }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    keepAliveInFlight.current = false;

    if (response?.status === 401) {
      await endSession();

      return false;
    }

    if (response?.ok) {
      lastServerUse.current = Date.now();
      deadlines.current = deadlinesFrom(payload?.data, Date.now()) ?? deadlines.current;
      setUnreachable(false);
      check();
    } else {
      // Network or 5xx: the session may still be alive, but this tab cannot
      // confirm it. Say so rather than let the countdown run out silently.
      setUnreachable(true);
    }

    return Boolean(response?.ok);
  }, [endSession, check]);

  // Learn the deadlines once. The server render that mounted this already
  // used the session, so this moves the idle limit by no more than that did.
  useEffect(() => {
    keepAlive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A navigation is activity, but not proof the admin saw a request — see above.
  useEffect(() => {
    if (Date.now() - lastServerUse.current >= KEEPALIVE_MS) keepAlive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    // The patient is here. If the admin has not heard from this session for a
    // while, tell it now — at the moment of the activity, so the session is
    // never extended past the patient's real last touch. Not while the warning
    // is up: there, only the explicit choice counts.
    function onInteraction() {
      if (warning) return;

      const now = Date.now();
      const due = deadlines.current ? now - lastServerUse.current >= KEEPALIVE_MS : now - lastAttempt.current >= RETRY_UNKNOWN_MS;

      if (due) keepAlive();
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
  }, [warning, keepAlive, check]);

  // Near the cap, "Continue" only hides the warning: nothing can move the cap.
  const dismissCap = useCallback(() => {
    capDismissed.current = true;
    setWarning(null);
  }, []);

  // While the warning is up: focus starts on "Stay signed in", Tab stays inside
  // the dialog, and Escape means stay — dismissing a "still there?" is an answer.
  useEffect(() => {
    if (!warning) return undefined;

    stayButton.current?.focus();

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (warning === 'absolute') dismissCap();
        else keepAlive();

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
  }, [warning, keepAlive, dismissCap]);

  if (!warning) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const cap = warning === 'absolute';

  return (
    <div ref={dialog} className="prx-timeout" role="alertdialog" aria-modal="true" aria-labelledby="prx-timeout-title" aria-describedby="prx-timeout-body">
      <div className="prx-timeout__panel">
        <h2 id="prx-timeout-title">{cap ? 'Your session is about to end' : 'Still there?'}</h2>
        {/* The countdown is not a live region: announcing every second would
            drown a screen reader. The dialog is announced once on opening. */}
        <p id="prx-timeout-body" className="prx-muted">
          {cap ? 'Sessions have a time limit, so you’ll be signed out in ' : 'For your security you’ll be signed out in '}
          <span aria-hidden="true">
            {minutes}:{seconds}
          </span>
          <span className="prx-visually-hidden">less than two minutes</span>.
          {cap ? ' Save or copy anything you’re writing, then sign in again to carry on.' : null}
        </p>
        {unreachable && !cap ? (
          <p className="prx-timeout__error" role="alert">
            We couldn&rsquo;t reach the server. Check your connection and try again.
          </p>
        ) : null}
        <p className="prx-timeout__actions">
          {cap ? (
            <button ref={stayButton} type="button" className="prx-task__cta" onClick={dismissCap}>
              Continue
            </button>
          ) : (
            <button ref={stayButton} type="button" className="prx-task__cta" onClick={keepAlive}>
              Stay signed in
            </button>
          )}
          <button type="button" className="prx-timeout__secondary" onClick={() => endSession({ expired: false })}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
