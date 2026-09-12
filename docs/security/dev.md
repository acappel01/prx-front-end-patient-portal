# Security

These rules are load-bearing. Relaxing any of them reintroduces a defect that has already been
found and fixed once.

## Identity and ownership

**Chart ownership is never inferred from email equality.** A matching email address is not proof
of identity. Linking a clinical record to an account needs two proofs, both checked by the admin:
the order's encounter (which only the admin's own server or a signed webhook can write) and a
single-use link emailed to the address the order was placed under.

**Connecting a record is two steps, and this app decides neither.** `/connect` posts an empty
body to `/patient/claim-links`; the admin finds the order from the session and emails its
mailbox. The link lands on `/claim/{token}`, which posts `{token}` to `/patient/claim`. Rules
this screen pair must keep:

- **Never spend the token on page load.** Mail scanners open links before people do. The claim
  page renders a button; only the POST consumes.
- **Never carry the token into a second URL** — no `?next=`, no redirect. The claim page sits
  outside the authenticated layout and signs in in place (`LoginForm stayOnPage`).
- **The token goes in a body, with `referrerPolicy: 'no-referrer'`**, and the page is served with
  `Referrer-Policy: no-referrer`. A deployment's reverse proxy must keep `/claim/` request lines
  and claim-page Referers out of its access log — a `combined` log records both.
- **Do not interpret the answers.** Requesting a link answers the same 202 whether or not an
  order matched, and a failed claim gives one sentence for unknown, used, expired and
  not-yours. Both are deliberate; show them as sent.
- There is no order reference to type and no `?order=` on `/connect`. An order uuid is not proof
  of anything, and the endpoint that accepted one was removed.

**Every identifier resolves from the session's own record.** Never accept a caller-supplied
encounter, prescription or order identifier as authority — resolve it from the authenticated
patient's own set and reject anything outside it. Forwarding an unfiltered request body is how a
patient ends up acting on another patient's record.

**Least-privilege abilities.** Approving a charge is a distinct ability from updating a profile.
A session may be scoped without it.

**Handle a missing ability as re-authentication, not failure.** Tokens minted before an ability
existed will lack it. Detect the authorization failure and prompt re-auth — never render a
control that is guaranteed to fail.

## Session and transport

- `no-store` and `noindex` on every route.
- Separate root layout from the storefront — this application must not inherit operator script
  injection.
- `Referrer-Policy: same-origin` on any route whose URL carries an identifier.
- `Referrer-Policy: no-referrer` on `/claim/*`, whose URL carries a credential rather than an
  identifier. `same-origin` would repeat it as the Referer on that page's own requests.
- No third-party script, font, or asset host on an authenticated page.

## Payment data

- The card number never reaches a server. Tokenize in the browser.
- A single-use checkout token is exchanged for a **durable vault profile** before it is used or
  passed onward; a nonce expires long before a deferred capture.
- The portal displays a stored card (brand and last four) read-only. Adding or replacing a card
  is a separate deliberate flow, never a side effect of approving a charge.

## Data minimisation

Clinical values reach the browser only where a screen renders them. Nothing clinical is logged,
sent to an analytics destination, or placed in a URL.
