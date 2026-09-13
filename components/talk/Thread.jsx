'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import LocalTime from '@/components/ui/LocalTime';

/**
 * One conversation with the care team: read, poll, reply.
 *
 * ── Polling, not push ────────────────────────────────────────────────────────
 *
 * The provider's real-time channel cannot authorise a bearer token, so new
 * messages are fetched with its keyset cursor (`?after=<newest message id>`),
 * which returns only what is newer and the next cursor. `latest_cursor` is null
 * when nothing arrived, so the old cursor is kept. A cursor that is a time
 * (only for a thread that started empty) is second-granular; the first message
 * that arrives replaces it with an id.
 *
 * ── Cadence, and why it pauses ───────────────────────────────────────────────
 *
 * Every 15 s while the patient is using the screen, 60 s after five minutes
 * without a tap or keypress, and not at all while the tab is hidden. After TEN
 * minutes untouched it stops and says so (sending wakes it) (operator decision, 2026-09-13): every
 * poll is a use of the session, so a thread left open would otherwise keep the
 * admin's idle sign-out from ever applying. Failures back off to two minutes.
 *
 * ── Sending ──────────────────────────────────────────────────────────────────
 *
 * The message shows at once and is confirmed by the provider's answer, then
 * deduplicated by id when the next poll returns it. If the send fails with no
 * clear answer, nothing is re-sent automatically — the provider has no
 * idempotency on this call, so a retry could post it twice. The draft is kept
 * and the next poll shows whether it went through.
 *
 * ── Older messages ───────────────────────────────────────────────────────────
 *
 * The first page (newest 50) arrives with where it sits. "Load older" asks for
 * the next page by NUMBER — the provider has no `before` cursor — and those
 * pages are offset-based, so a message that arrived since shifts every row one
 * place older and the next page repeats one. Merging by id absorbs that. The
 * reader's place is kept: the list grows above them, so the window is moved by
 * exactly the height that was added.
 */

const ACTIVE_MS = 15_000;
const IDLE_MS = 60_000;
const IDLE_AFTER_MS = 5 * 60_000;
const PAUSE_AFTER_MS = 10 * 60_000;
const MAX_BACKOFF_MS = 120_000;

function merge(existing, incoming) {
  const seen = new Set(existing.map((message) => message.id));

  return [...existing, ...incoming.filter((message) => !seen.has(message.id))];
}

function mergeOlder(existing, older) {
  const seen = new Set(existing.map((message) => message.id));

  return [...older.filter((message) => !seen.has(message.id)), ...existing];
}

export default function Thread({ conversationId, initialMessages, initialCursor, initialPage = 1, lastPage = 1 }) {
  const [messages, setMessages] = useState(initialMessages);
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState(lastPage);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderNotice, setOlderNotice] = useState(null);
  // Document height before older messages were prepended; consumed once.
  const heightBefore = useRef(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [paused, setPaused] = useState(false);
  const cursor = useRef(initialCursor);
  const lastInteraction = useRef(Date.now());
  const failures = useRef(0);
  const polling = useRef(false);
  const timer = useRef(null);
  const listEnd = useRef(null);
  // False once unmounted: a poll in flight when the patient taps away must not
  // schedule another, or the abandoned thread keeps polling (and keeping the
  // session alive) in the background.
  const alive = useRef(true);

  const base = `/api/portal/patient/conversations/${conversationId}/messages`;

  const poll = useCallback(async () => {
    if (polling.current || !cursor.current) return;
    polling.current = true;

    try {
      for (let round = 0; round < 5; round++) {
        const response = await fetch(`${base}?after=${encodeURIComponent(cursor.current)}&per_page=50`, { cache: 'no-store' }).catch(() => null);

        if (response?.status === 401) {
          window.location.assign('/login');

          return;
        }

        const payload = await response?.json().catch(() => null);

        if (response?.status === 403 && payload?.code === 'two_factor_setup_required') {
          window.location.assign('/record/security?required=1');

          return;
        }

        if (!response?.ok || !payload?.data) {
          failures.current += 1;

          return;
        }

        failures.current = 0;
        const { messages: fresh = [], latest_cursor: next, has_more: more } = payload.data;

        if (fresh.length > 0) setMessages((current) => merge(current, fresh));
        if (next) cursor.current = next;
        if (!more) return;
      }
    } finally {
      polling.current = false;
    }
  }, [base]);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);

    const untouched = Date.now() - lastInteraction.current;

    if (untouched >= PAUSE_AFTER_MS) {
      setPaused(true);

      return;
    }

    const delay = failures.current > 0
      ? Math.min(MAX_BACKOFF_MS, ACTIVE_MS * 2 ** failures.current)
      : untouched >= IDLE_AFTER_MS ? IDLE_MS : ACTIVE_MS;

    timer.current = window.setTimeout(async () => {
      if (document.visibilityState === 'visible') await poll();
      if (alive.current) schedule();
    }, delay);
  }, [poll]);

  useEffect(() => {
    function touched() {
      lastInteraction.current = Date.now();
    }

    function visible() {
      if (document.visibilityState === 'visible' && !paused) poll();
    }

    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched, { passive: true });
    document.addEventListener('visibilitychange', visible);

    if (!paused) schedule();

    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [paused, poll, schedule]);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  // Follow the NEWEST message, not the count: loading older messages grows the
  // list too, and must not throw the reader to the bottom.
  const newestId = messages.at(-1)?.id;

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [newestId]);

  useLayoutEffect(() => {
    if (heightBefore.current === null) return;

    window.scrollBy(0, document.documentElement.scrollHeight - heightBefore.current);
    heightBefore.current = null;
  }, [messages]);

  async function loadOlder() {
    if (loadingOlder || page >= pages) return;

    setLoadingOlder(true);
    setOlderNotice(null);
    lastInteraction.current = Date.now();

    const next = page + 1;
    const response = await fetch(`${base}?page=${next}&per_page=50`, { cache: 'no-store' }).catch(() => null);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    const payload = await response?.json().catch(() => null);

    if (response?.status === 403 && payload?.code === 'two_factor_setup_required') {
      window.location.assign('/record/security?required=1');

      return;
    }

    if (!alive.current) return;

    setLoadingOlder(false);

    if (!response?.ok || !Array.isArray(payload?.data)) {
      setOlderNotice('We couldn’t load older messages. Please try again.');

      return;
    }

    // Newest first from the provider; this list reads oldest first.
    const older = payload.data.slice().reverse();

    heightBefore.current = document.documentElement.scrollHeight;
    setMessages((current) => mergeOlder(current, older));
    setPage(payload.meta?.current_page ?? next);
    setPages(payload.meta?.last_page ?? next);
  }

  function resume() {
    lastInteraction.current = Date.now();
    setPaused(false);
    poll();
  }

  async function send(event) {
    event.preventDefault();

    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setNotice(null);
    // Sending is a touch: wake a paused thread, so the reply shows up.
    lastInteraction.current = Date.now();
    setPaused(false);

    const response = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);
    setSending(false);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    if (response?.ok && payload?.data?.id) {
      setMessages((current) => merge(current, [{ ...payload.data, is_mine: true }]));
      setDraft('');
      poll();

      return;
    }

    if (response?.status === 422) {
      setNotice(payload?.errors?.content?.[0] ?? payload?.message ?? 'That message could not be sent.');

      return;
    }

    // No clear answer: it may have gone. Keep the draft, don't resend.
    setNotice('We couldn’t confirm that was sent. It will appear above if it went through — check before sending again.');
    poll();
  }

  return (
    <>
      {page < pages ? (
        <p className="prx-thread__older">
          <button type="button" className="prx-link" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        </p>
      ) : null}
      {olderNotice ? (
        <p className="prx-field__error prx-thread__older" role="alert">
          {olderNotice}
        </p>
      ) : null}

      <ol className="prx-thread" role="log" aria-label="Messages">
        {messages.length === 0 ? <li className="prx-thread__empty prx-muted">No messages yet. Say hello below.</li> : null}
        {messages.map((message) => (
          <li key={message.id} className={`prx-bubble ${message.is_mine ? 'prx-bubble--mine' : ''}`}>
            <span className="prx-visually-hidden">{message.is_mine ? 'You' : (message.sender_name ?? 'Care team')}: </span>
            {!message.is_mine && message.sender_name ? <span className="prx-bubble__who" aria-hidden="true">{message.sender_name}</span> : null}
            <span className="prx-bubble__text">{message.content}</span>
            {message.created_at ? (
              <span className="prx-bubble__when">
                <LocalTime value={message.created_at} />
              </span>
            ) : null}
          </li>
        ))}
        <li ref={listEnd} aria-hidden="true" className="prx-thread__end" />
      </ol>

      {paused ? (
        <p className="prx-thread__paused">
          <button type="button" className="prx-link" onClick={resume}>
            Paused — tap to check for new messages
          </button>
        </p>
      ) : null}

      <form className="prx-composer" onSubmit={send}>
        <label htmlFor="message" className="prx-visually-hidden">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={2}
          maxLength={5000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={notice ? 'composer-notice' : undefined}
          placeholder="Write a message"
        />
        <button type="submit" className="prx-task__cta" disabled={sending || draft.trim() === ''}>
          {sending ? 'Sending…' : 'Send'}
        </button>
        {notice ? (
          <p id="composer-notice" className="prx-field__error" role="alert">
            {notice}
          </p>
        ) : null}
      </form>
    </>
  );
}
