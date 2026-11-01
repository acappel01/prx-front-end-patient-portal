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
  as "did not match". The sign-in route did exactly that until 2026-09-13; the limiter is per network
  address, not per account, so naming it reveals nothing about who is a patient.
- **Only a credential refusal is "did not match"** (`lib/signInRefusal.js`, used by
  `app/api/session/route.js` and `app/api/session/two-factor/route.js`). The admin's bad-credential
  answer is a 422 (a 401 is treated the same). A 5xx, a maintenance 503, a 404 from a wrong
  `ADMIN_API_BASE_URL`, or a 200 without a session is "We couldn't sign you in right now" (503) with
  the admin's Reference, and the route logs the status and request id — never the email or the
  password. Before this, an outage told patients their password was wrong, and they retyped it into
  the per-address limiter. On the code step, only a 422 is "that code didn't work".
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

**What the admin actually enforces on a patient token.** Every patient token carries the single
`patient:*` ability, and no admin route checks abilities, so there is no per-action scoping to
rely on (approving a charge is not a separate ability). The controls that do apply are: the
admin's patient guard (a patient token is only a patient token); the session lifetime (idle limit
and absolute cap, see below); the two-step gate (`403 {code: two_factor_setup_required}` under the
`required` policy); every identifier pinned to the session's own chart, with ownership checks on
anything addressed by id; writes limited to what the admin allows (and, here, to the proxy
allowlist); and, before a charge, the patient confirming the total (`acknowledged_total` must match
what the admin will charge). A 401 is a dead or expired session and every screen treats it as
"sign in again"; nothing in the portal infers a missing ability from it.

## Session and transport

- **Every write is origin-checked** (`lib/requestGuard.js`). `SameSite=Strict` does not separate
  sibling subdomains: `portal.example.com`, the storefront on `example.com` (which runs
  operator-pasted tags by design) and `admin.example.com` are one site, so a script on any of them
  can send this portal a credentialed POST. Every non-GET handler under `app/api` calls
  `guardRequest()` first — the proxy, sign-in and sign-out, the two-step code, the three account
  routes and the intake upload:
  - accepted when `Sec-Fetch-Site` is `same-origin`; otherwise `Origin` must equal `PORTAL_URL`'s
    origin, or the answer is 403 `{code: 'cross_origin'}`. No Origin at all is refused.
  - a JSON route refuses any Content-Type other than `application/json` with 415, so a CORS
    "simple" `text/plain` or form post is never parsed. A bodiless POST is fine.
  - a declared `Content-Length` over the cap is 413 before anything is read: 16 KB for the
    session, two-step and account routes, 64 KB for the proxy, 42 MB for the multipart intake.
    Bodies are read only through `readBody()`, which counts bytes as they arrive, so a chunked
    body with no length hits the same cap. Never call `request.json()` in a handler.
  - `PORTAL_URL` unset or invalid fails closed: 500 `{code: 'misconfigured'}`, logged once.

  GETs are not checked: a cross-origin read cannot see the answer and no GET here changes
  anything. Keep it that way — a GET that writes would bypass this.
- **The proxy allowlist holds only what a screen calls.** Scheduling (slots, appointments) and the
  video token were removed on 2026-11-01 because no screen used them; re-add each with its screen.
- `no-store` and `noindex` on every route.
- Separate root layout from the storefront — this application must not inherit operator script
  injection.
- `Referrer-Policy: same-origin` on any route whose URL carries an identifier.
- `Referrer-Policy: no-referrer` on `/claim/*`, `/create-account/*` and `/reset/*`, whose URLs
  carry a credential rather than an identifier. `same-origin` would repeat it as the Referer on
  that page's own requests.
- No third-party script, font, or asset host on an authenticated page. The admin's Google Fonts
  stylesheet is relayed through this origin (`/fonts/stylesheet`, `/fonts/file/*`, `lib/fonts.js`):
  only `fonts.googleapis.com/css2?…` and font files under `fonts.gstatic.com` are fetched, and a
  stylesheet that would still load anything from elsewhere is dropped whole. `/fonts/file/*`
  relays only the files the brand's current stylesheet names; any other path is a 404 (`no-store`),
  so it is not a free relay and cannot fill the shared cache. Theme > Custom CSS is
  applied only when it loads nothing (`url(`, `image-set(`, `@import`) and holds no `<` or `\`.
- **The browser enforces that too** (`middleware.js`, `lib/securityHeaders.js`). Every page gets:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per request>';
    style-src 'self' 'unsafe-inline'; img-src 'self' data: <admin origin>; font-src 'self';
    connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`.
    The middleware mints the nonce and puts the policy on the request as well as the response,
    which is where the App Router reads the nonce it stamps on its own scripts. Styles keep
    `'unsafe-inline'` because the theme tokens and Custom CSS are inline `<style>` and progress bars
    use `style=""` (a nonce cannot cover an attribute, and a nonce in `style-src` would turn
    `'unsafe-inline'` off). `img-src` names the admin's origin for the logo and favicon; `data:` is
    the two-step QR code. `next dev` adds `'unsafe-eval'` to scripts; production never does.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

  A deployment extends a directive with `CSP_IMG_SRC`, `CSP_CONNECT_SRC`, `CSP_SCRIPT_SRC`,
  `CSP_STYLE_SRC`, `CSP_FONT_SRC`, `CSP_FRAME_SRC`, `CSP_MEDIA_SRC` or `CSP_WORKER_SRC`
  (space-separated hosts or schemes). Only hosts, schemes and `'wasm-unsafe-eval'` are accepted;
  anything else (`'unsafe-inline'`, a `;`) is dropped and logged, so an env var cannot reopen inline
  script. `PERMISSIONS_ALLOW="camera microphone"` turns those features on for this origin only, for
  the day a video visit ships (with `CSP_FRAME_SRC`/`CSP_CONNECT_SRC` for its SDK). The middleware
  sets headers only: it never reads the session, which the `(portal)` layout and each route handler
  still check. Never add a `<script>` tag or `dangerouslySetInnerHTML` script; there is no nonce for
  it to use.
- **A signed cookie proves we minted it, not that the admin still honours it.** A claim revokes
  other sessions, so a validly signed cookie can hold a dead token. `/login` asks `/patient/auth/me`
  before bouncing to `/` — trusting the signature there was an inescapable
  `/login` → `/` → "Session expired" → `/login` loop with no way to sign in. The `(portal)` layout
  must **not** make the same call: a `/me` per page view is an extra admin round-trip on every
  navigation and spends the patient's per-account API budget (120/min) on what each screen already
  learns from its own 401. Screens under it turn a 401 into a link. (`/me` and logout left the
  per-IP sign-in limiter on 2026-09-13 — a 429'd logout used to leave the token alive.)
- **One implementation of a signed cookie** (`readSigned(name, purpose)` / `writeSigned(name, value,
  purpose, maxAge)` in `lib/session.js`). The session, the two-step challenge and the trusted browser
  all go through it: httpOnly, Secure, SameSite=Strict, `<value>.<HMAC>`, the purpose inside the
  signed input (the session's input stays un-prefixed so live sessions stay valid), compared in
  constant time, and a bad cookie reads as no cookie. `scripts/security.test.mjs` copies a challenge
  into the session cookie and expects it refused.
- **Signing in again revokes the old token.** When a sign-in (or a create-account link) succeeds
  while this browser still holds a session cookie, the route reads the old token first and, once the
  response has gone (`revokeAfterResponse()` in `lib/adminApi.js`, Next's `after()`), calls the
  admin's `POST /patient/auth/logout` with it. The same happens when the password step answers with
  a two-step challenge, since that ends the old cookie too. A failed sign-in leaves the existing
  session alone. Best effort: a token this cannot reach still ends at the admin's idle limit.
- **Sessions end admin-side**: 30 minutes idle and 12 hours absolute by default (the admin's Settings →
  Patient portal). The cookie deliberately has no max-age of its own — a dead token is a 401 every
  screen already handles. `components/shell/SessionTimeout.jsx` warns two minutes before whichever
  ends first. Every keep-alive answers with the session's own deadlines — `idle_expires_at` and the
  absolute `expires_at` from the admin, plus `now` from this server's clock so a device clock that
  is out does not move the warning (`lib/sessionClock.js`) — and one keep-alive on mount learns them;
  nothing comes from `/config`. Near the idle limit it asks "Still there?" with Stay signed in. Near
  the absolute cap nothing can extend the session, so it says the session is about to end and to
  save what they are writing; Continue only dismisses it, and the cap lands on
  `/login?expired=limit` with its own notice. A navigation, tap or keypress
  sends a quiet keep-alive (`GET /api/session` → admin `GET /patient/session`) whenever the admin has
  not heard from the tab for five minutes; the tab's clock moves only when a keep-alive succeeds, so a
  navigation to a screen that makes no admin call (`/connect`, `/health/log`, back/forward) cannot
  hide an expiry. The warning can come early, never late. It never extends anything the admin would
  not. On expiry it clears the cookie and lands on `/login?expired=1`; a deliberate Sign out from the
  warning lands on `/login`. Keep-alives go
  through the admin's general patient limiter (`GET /patient/session`), which is what the admin counts
  as use of the session.
- **Two-step sign-in** (admin: `docs/portal/dev.md` → "Two-step verification"). After a correct
  password the admin returns a challenge, never a token. `app/api/session/route.js` puts it in its own
  `prx_challenge` cookie — httpOnly, Secure, SameSite=Strict, five minutes, signed under a different
  HMAC purpose than `prx_session` so a copied value never verifies as the other — and tells the
  browser only `{two_factor: true}`. `/login/verify` renders only while that cookie exists;
  `POST /api/session/two-factor` reads the challenge from the cookie (never from the body), exchanges
  it with the code, and sets the session. Refusals keep the admin's one sentence; a 429 or a missing
  challenge sends the patient back to the password. Known limit: signing in from a claim link with
  two-step on lands on Home, not back on the claim page (the claim URL carries a token and is never
  copied into a `next` parameter) — the link in the email still works.
- **Trusted browsers.** Ticking *Trust this browser* on the code step returns an admin token that
  `app/api/session/two-factor/route.js` stores in `prx_device` — httpOnly, Secure, Strict, signed under
  the `device` purpose, max-age = the admin's expiry. `app/api/session/route.js` sends it with every
  password sign-in as `trusted_device_token`; the admin decides (password first, this patient only)
  and, on a hit, returns the renewed expiry, which re-sets the cookie's max-age — without that the
  cookie would lapse at the original expiry however often it was used.
  The cookie deliberately survives sign-out. A stale or revoked token is simply ignored upstream.
  Record → Two-step verification lists trusted browsers with Remove / Remove all (two proxy entries).
- **Two-step management** (Record → Two-step verification, `components/account/TwoFactorManager.jsx`)
  goes through four POST proxy entries. Recovery codes exist only in the confirm/regenerate response
  and component state; nothing stores them. The QR code is an admin-rendered SVG data URI. Under the
  `required` policy the admin answers other screens with `403 {code: two_factor_setup_required}`;
  every server screen (`guard()` in `lib/screenGuards.js`) and every browser call (`lib/portalClient.js`)
  redirect to `/record/security?required=1` (`TWO_FACTOR_SETUP_PATH`, `lib/landing.js`), which `adminFetch` makes possible by
  passing `code` through. The Home invitation's "Not now" is a plain 30-day preference cookie
  holding no identity, and hides the card through React state — removing the node directly made the
  next tab tap crash the page (React unmounting a node that was gone). Setting it up the first time
  asks for the password.
- **Every admin call carries the patient's address and browser** (`lib/adminApi.js`). The admin
  sees this server as the caller, so without it every audit IP is the portal host and every
  per-IP rate limit is one shared bucket. Exactly **one** `X-Forwarded-For` value is sent: the
  rightmost incoming entry, which the reverse proxy in front appended. Entries to its left are
  caller-supplied and dropped. The admin must list this host in `TRUSTED_PROXIES` or it ignores
  the header. A loopback value is logged — it means a request bypassed the reverse proxy. Put a
  CDN in front and the true client is no longer the rightmost entry: change the extraction and
  the admin's trusted proxies together.

- **One browser header reaches the admin: `Idempotency-Key`** (`lib/idempotencyHeader.js`). The
  proxy forwards it by name, on writes only, and only when it is a plain token
  (`^[\x21-\x7E]{8,255}$`); every other browser header stays here. `VitalsForm` mints one key per
  attempt (a new one after a 422 or a changed value), and the admin answers a repeated key with the
  first result instead of writing a second reading.

- **The patient can see their own sign-in activity** (Record, `components/account/SecurityHistory.jsx`,
  from `GET /patient/security/events`). It is a server component through `adminFetch`, so it has no
  proxy allowlist entry and no browser path. The admin's resource is a whitelist; this side filters
  nothing and must not add fields the admin withholds — above all, never distinguish "unknown
  address" from "wrong password" on a failed attempt. It renders nothing on an error response or a
  network failure (`adminFetch`'s status 0), so the history never puts the Record screen
  into an error state. On staff- or system-made changes the admin sends no IP or browser. Signing out records a
  `logout` event admin-side, which is one more reason `DELETE /api/session` must keep calling the
  admin rather than only clearing the cookie.

## Payment data

- **Approving a charge retries only on `code: 'error'`** (`lib/approvalOutcome.js`, used by
  `components/care/ApprovalList.jsx`). That is the one answer where the admin knows nothing was
  charged, and only it gets a new idempotency key. Anything else unclear — a dropped connection,
  the proxy's 504 `upstream_unreachable`, a 5xx or 502/504 from the web server with no code, an
  unknown code — is uncertain: the key is kept (also in this tab's `sessionStorage`, so an approve
  after a reload replays the same attempt), the screen says the payment may still be processing and
  offers no button. The proxy never turns an unreachable admin into a bodiless 500. See
  `approvals/dev.md`.

- The card number never reaches a server. Tokenize in the browser.
- A single-use checkout token is exchanged for a **durable vault profile** before it is used or
  passed onward; a nonce expires long before a deferred capture.
- The portal displays a stored card (brand and last four) read-only. Adding or replacing a card
  is a separate deliberate flow, never a side effect of approving a charge.

## Data minimisation

- **Demographics are shown, not stored.** Record → Your details reads name, date of birth, contact and
  patient number live from the admin (`GET /patient/profile` → the provider) on each visit; the admin
  keeps only the provider's identifiers. Nothing is cached in the portal.
- **The one opaque value an error screen shows is a correlation id.** On a 5xx (and on the vitals
  "couldn't confirm" outcome) screens render `Reference: <uuid>` — the admin's `X-Request-ID`, minted
  per request, also sent to the clinical provider and echoed in its logs. It is not PHI, not a
  credential and not enumerable; it lets support find the failed request. It is never shown on a 401
  or 422, where there is nothing for support to look up.

Clinical values reach the browser only where a screen renders them. Nothing clinical is logged,
sent to an analytics destination, or placed in a URL.

## Uploads

The only upload is sending what a held visit needs (`/care/intake/[id]`). It does **not** go through
the generic proxy: `app/api/intake/[id]/route.js` is origin-checked like every write, requires
`multipart/form-data`, and reads the body with a 42 MB cap through `readBody()` (a declared
`Content-Length` over it is refused before reading, and nothing is read before the session check), keeps only the named text fields and the four
photo fields, refuses any photo that is not JPEG/PNG/WebP or is over 10 MB, renames files to neutral
names (`id_front.jpg` — a patient's own filename travels nowhere), and sends a freshly built form to
the admin, which validates everything again (raster types by content, SVG refused). Nothing is
stored on either side; no antivirus scan runs (operator decision 2026-09-13 — the files are never
stored by us and are passed to the clinical provider).
