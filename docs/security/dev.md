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
- **A visitor arriving from a mail app usually looks signed out when they are not.** The session
  cookie is `SameSite=Strict`, which a browser withholds on a navigation that started on another
  site. `ClaimSignIn` re-requests the same URL once from this origin (same-site, so the cookie is
  sent) before showing the form, guarded by a short-lived `sessionStorage` flag so it cannot loop.
  Do not "fix" this by relaxing the cookie to `Lax`.
- **The token goes in a body, with `referrerPolicy: 'no-referrer'`**, and the page is served with
  `Referrer-Policy: no-referrer`. A deployment's reverse proxy must keep `/claim/` request lines
  and claim-page Referers out of its access log — a `combined` log records both.
- **Do not interpret the answers.** Requesting a link answers the same 202 whether or not an
  order matched, and a failed claim gives one sentence for unknown, used, expired and
  not-yours. Both are deliberate; show them as sent.
- There is no order reference to type and no `?order=` on `/connect`. An order uuid is not proof
  of anything, and the endpoint that accepted one was removed.

**Accounts are created by an emailed link, never by a form.** `/register` and `/forgot` take only
an email address and post it to `/api/account/link`, which calls the admin's register or forgot
route — the same decision either way: an address with an account is sent a reset link, one with
an order and no account a create-account link, anything else nothing. The links land on
`/create-account/{token}` and `/reset/{token}`. Rules for these pages:

- **There is no name, password or chart field at registration**, and none may be added. An
  account's email is the address the link reached; a form field would let someone register a
  stranger's address, which is the squatting this replaced.
- **Say only what the admin says.** Its 202 sentence is identical whether it found an account,
  an order, or nothing. Never render "we found your account" or "no account with that email" —
  that tells anyone whether a named person is a patient. A 429 is shown as a rate limit, never
  as "did not match" (the sign-in route's known flaw — do not copy it).
- **Never spend or even check the token on page load.** Both pages render a password form and
  ask the admin nothing until it is submitted; a validity check on load is a lookup any mail
  scanner could trigger.
- **Same token hygiene as `/claim/`**: token in a POST body with `referrerPolicy: 'no-referrer'`,
  pages served with `Referrer-Policy: no-referrer`, and the reverse proxy keeps `/create-account/`
  and `/reset/` request lines and those pages' Referers out of its access log.
- **Create-account signs in; reset does not.** The admin returns a session for a new account,
  exchanged for the cookie in `/api/account/create` exactly as sign-in does. A reset signs every
  session out and issues none — the link proves the mailbox and must not stand in for a second
  factor — so `/reset` ends at "Sign in". No Strict-cookie reload is needed on either page: no
  session is expected on arrival.
- These three routes are **not** in the portal proxy allowlist: the proxy requires a session, and
  these are the pages for people who do not have one. Each rebuilds its upstream body from the
  fields the admin reads rather than forwarding the request.

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
- `Referrer-Policy: no-referrer` on `/claim/*`, `/create-account/*` and `/reset/*`, whose URLs
  carry a credential rather than an identifier. `same-origin` would repeat it as the Referer on
  that page's own requests.
- No third-party script, font, or asset host on an authenticated page.
- **A signed cookie proves we minted it, not that the admin still honours it.** A claim revokes
  other sessions, so a validly signed cookie can hold a dead token. `/login` asks `/patient/auth/me`
  before bouncing to `/` — trusting the signature there was an inescapable
  `/login` → `/` → "Session expired" → `/login` loop with no way to sign in. The `(portal)` layout
  must **not** make the same call: `/me` is behind the admin's `auth` limiter (10/min per IP), so a
  call per page view locks a patient out of signing in. Screens under it turn a 401 into a link.
- **Every admin call carries the patient's address and browser** (`lib/adminApi.js`). The admin
  sees this server as the caller, so without it every audit IP is the portal host and every
  per-IP rate limit is one shared bucket. Exactly **one** `X-Forwarded-For` value is sent: the
  rightmost incoming entry, which the reverse proxy in front appended. Entries to its left are
  caller-supplied and dropped. The admin must list this host in `TRUSTED_PROXIES` or it ignores
  the header. A loopback value is logged — it means a request bypassed the reverse proxy. Put a
  CDN in front and the true client is no longer the rightmost entry: change the extraction and
  the admin's trusted proxies together.

- **The patient can see their own sign-in activity** (Record, `components/account/SecurityHistory.jsx`,
  from `GET /patient/security/events`). It is a server component through `adminFetch`, so it has no
  proxy allowlist entry and no browser path. The admin's resource is a whitelist; this side filters
  nothing and must not add fields the admin withholds — above all, never distinguish "unknown
  address" from "wrong password" on a failed attempt. It renders nothing on an error response or a
  network failure (it catches `adminFetch`'s throw), so the history never puts the Record screen
  into an error state. On staff- or system-made changes the admin sends no IP or browser. Signing out records a
  `logout` event admin-side, which is one more reason `DELETE /api/session` must keep calling the
  admin rather than only clearing the cookie.

## Payment data

- The card number never reaches a server. Tokenize in the browser.
- A single-use checkout token is exchanged for a **durable vault profile** before it is used or
  passed onward; a nonce expires long before a deferred capture.
- The portal displays a stored card (brand and last four) read-only. Adding or replacing a card
  is a separate deliberate flow, never a side effect of approving a charge.

## Data minimisation

Clinical values reach the browser only where a screen renders them. Nothing clinical is logged,
sent to an analytics destination, or placed in a URL.
