# Messaging

Talk lists conversations; `/talk/[id]` is one thread; `/talk/new` starts one for a visit.

## Reading and polling

The provider's real-time channel cannot authorise a bearer token, so new messages are **polled** with
its keyset cursor. `app/(portal)/talk/[id]/page.jsx` reads the first page server-side
(`GET /patient/conversations/{id}/messages?per_page=50`, newest first, reversed for reading) and hands
the newest message id to `components/talk/Thread.jsx` as the cursor. Thread then asks
`?after=<cursor>&per_page=50` and gets `{messages (oldest first), count, latest_cursor, has_more}`.

- `latest_cursor` is **null when nothing arrived** — the old cursor is kept.
- `has_more` loops immediately (at most five pages per poll).
- An empty thread starts from a time cursor a second before render. A time cursor is strict and
  second-granular, so it can skip a message sent in that same second; the first message that arrives
  replaces it with an id, which cannot.
- New messages are merged by id, so a message this tab sent and the poll that returns it appear once.

## Cadence

| Situation | Poll |
|---|---|
| Tapped or typed in the last 5 minutes | every 15 s |
| Visible, untouched 5–10 minutes | every 60 s |
| Untouched 10 minutes | **paused**: "Paused — tap to check for new messages"; sending a message also wakes it |
| Tab hidden | not at all; polls on return (unless it has passed 10 minutes untouched — then it is paused) |
| Failure | backs off 30 s → 2 min |

The pause is an operator decision (2026-09-13). Every poll is a use of the patient's session, so a
thread left open would otherwise keep the admin's 30-minute idle sign-out from ever applying. It also
bounds the provider's PHI-audit rows (each patient read writes one there) and our `throttle:api`
budget (120/min per patient).

## Sending

`POST /patient/conversations/{id}/messages` (`content`, max 5000). The message is added when the
provider's 201 returns its id. A 422 keeps the draft and shows the field error. Any other failure keeps
the draft and says the send could not be confirmed — **no automatic resend**: the provider has no
idempotency on this call, so a retry could post it twice. The next poll shows whether it went.

## Starting a conversation

`/talk/new` lists the patient's visits (`/patient/encounters`); choosing one posts
`/patient/encounters/{id}/conversation` through the proxy, which opens the visit's conversation or
returns the existing one, and goes there. The provider finds encounters only on the session's own chart.

## Known limits

- **Ours:** the thread shows the latest 50 messages; there is no "load older" yet (the admin's client
  drops the provider's pagination meta). Opening a thread also reads the conversation list for its
  subject — one extra provider call.

## Known upstream gaps

- No patient "mark as read" — `unread_count` on Talk never clears through the API.
- No push or webhook for new messages.

## Accessibility

The thread is `role="log"` (new messages announced politely), each message carries a visually hidden
"You:" / "<sender>:" so ownership is not colour-only, bubbles wrap anywhere, the composer is 16 px and
sticks above the tab bar with the safe-area inset.
