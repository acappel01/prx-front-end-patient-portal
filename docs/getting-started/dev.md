# Getting started

## Stack

Next.js 15 App Router · React 19 · Sass. No CSS framework, no component library and no charting
dependency: the lab and vitals charts are the portal's own SVG components (`components/charts/`),
behind a component boundary a deployment can swap.

Chosen to match the storefront skeleton so one team can move between the two, and because the
App Router's server components are what keep clinical data out of the browser bundle by default.

## Run it

```bash
cp .env.example .env      # fill in ADMIN_API_BASE_URL, SESSION_SECRET and PORTAL_URL
npm ci
npm run dev
npm test                  # node --test over scripts/*.test.mjs
```

`ADMIN_API_BASE_URL` is the **admin's** origin plus `/api/v1` (for example
`https://admin.example.com/api/v1`), never the storefront's. The storefront's proxy passes
only public calls, so pointed there the portal still shows the brand but every account call
(sign in, reset, create account) fails with a generic message. When the admin answers an
account call with anything unexpected, the portal logs `[account] admin answered HTTP <status>
on <route>` (no address, token or password); check the service log (`journalctl -u <service>`)
for it first.

`SESSION_SECRET` has no default and the app refuses to issue a session without one. That is
deliberate — an unset secret silently degrading to an unsigned cookie is a control that looks
present and is absent in production.

`PORTAL_URL` is required for the same reason. It is the `Origin` every write must come from
(`lib/requestGuard.js`, see `security/dev.md` → Cross-origin writes). Set it to the exact origin the
browser shows, `https://portal.example.com` in production and `http://localhost:3000` for
`npm run dev`. Unset or not a URL, every sign-in, form and button that changes something answers
500 `{code: 'misconfigured'}` and the service log says `[requestGuard] PORTAL_URL is not
configured…` once. Pages still render.

| Variable | Required | What it is |
|---|---|---|
| `ADMIN_API_BASE_URL` | Yes | The admin's origin plus `/api/v1`. Server-side only; there is no `NEXT_PUBLIC_` variant. |
| `SESSION_SECRET` | Yes | Signs the session cookie. `openssl rand -hex 32`. |
| `ADMIN_API_TOKEN` | When the admin's **Require tokens** is on for **Public read** | An API client token from the admin (**Users & access > API clients**) with **Public read**, sent only on the anonymous `/config` read so the brand loads. Patient calls carry the patient's own session token instead. |
| `PORTAL_URL` | Yes | This app's public origin, the only `Origin` a write is accepted from when the browser does not send `Sec-Fetch-Site: same-origin`. Same value as the admin's `PATIENT_PORTAL_URL`. |
| `CSP_IMG_SRC`, `CSP_CONNECT_SRC`, `CSP_SCRIPT_SRC`, `CSP_STYLE_SRC`, `CSP_FONT_SRC`, `CSP_FRAME_SRC`, `CSP_MEDIA_SRC`, `CSP_WORKER_SRC` | No | Extra sources for that Content-Security-Policy directive, space-separated hosts or schemes (`lib/securityHeaders.js`). The usual one is `CSP_IMG_SRC` when brand uploads are served from a storage or CDN host rather than the admin. |
| `PERMISSIONS_ALLOW` | No | Device features this origin may use, e.g. `camera microphone` (for a future video visit). Unset, camera, microphone and geolocation are off. |

On the admin, `PATIENT_PORTAL_URL` must be this app's origin (account, reset and claim emails link
here), and `TRUSTED_PROXIES` must name this host so the patient's address, which this app forwards
as `X-Forwarded-For`, is the one the admin records and rate-limits on.

## Layout

| Path | What lives there |
|---|---|
| `app/layout.js` | Universal shell. Puts the admin's theme tokens on `:root` (see `architecture/dev.md` → Theme and logo). No script tag, no third-party host. |
| `app/(portal)/` | The authenticated tree. Its layout is the single session gate. The five destinations are `/` (Home), `/care` (approvals, held-visit intake), `/talk` (threads, new), `/health` (log, goal, labs) and `/record` (orders, visits, health, notifications, export, security, membership); `/connect` asks an account with no linked record to connect it. |
| `app/login/` | Anonymous. Bounces to `/` only a session the admin still accepts (`/patient/auth/me`), never on the cookie's signature alone. |
| `app/claim/[token]/` | Anonymous. Lands a claim link; signs in in place. |
| `app/register/`, `app/forgot/` | Anonymous. Email-only forms that ask the admin to email a link. No account is created here. |
| `app/create-account/[token]/`, `app/reset/[token]/` | Anonymous. Land the emailed links; a password form, token spent only on submit. |
| `app/api/account/{link,create,reset}/` | The three anonymous account calls. Outside the proxy, which needs a session. |
| `app/fonts/` | The admin's brand fonts, relayed so no patient page loads from Google (`lib/fonts.js`). Only the files the brand's stylesheet names. |
| `middleware.js` | Security headers only (CSP with a per-request nonce, HSTS, Permissions-Policy; `lib/securityHeaders.js`). Never a session check. |
| `app/api/session/` | Sign in and out. Exchanges a credential for an admin token server-side. |
| `app/api/portal/[...path]/` | Same-origin proxy — **allowlisted**, never a passthrough. |
| `app/api/intake/[id]/` | The one multipart upload (what a held visit needs): capped, whitelisted, rebuilt — see `security/dev.md` → Uploads. |
| `app/api/export/[id]/` | Streams a ready copy of the record from the admin (`/patient/export/{id}/download`). Not a JSON relay, so outside the proxy. |
| `lib/` | `adminApi`, `session`, `portalProxy`, `theme`, `fonts`, `destinations`, `landing` (server-only), `requestGuard` (origin, type and size checks for every write), `portalClient` (browser calls through the proxy), `approvalOutcome` (what an approval answer means), `securityHeaders` (the CSP, HSTS and Permissions-Policy), `signInRefusal` (what a failed sign-in says), `rateLimit` (the 429 sentence and `Retry-After`), `exportPoll` (the record-copy poll's backoff), `sessionClock` (the session's idle and absolute deadlines), `labs`, `accountErrors`, and `format` (money and word helpers for display). |
| `scripts/*.test.mjs` | Unit tests (`npm test`, Node's built-in runner, no dependencies). The pure helpers are imported directly; `adminRoutes.test.mjs` runs route handlers and `adminApi` against a stubbed admin, with `scripts/support/hooks.mjs` resolving `@/` and stubbing `server-only`, `next/headers` and `next/server`. |
| `components/stack/` | The action stack. Renders a ranked list; never ranks one. |
| `public/scss/main.scss` | Mobile-first at 390 × 812. Desktop is a reflow of the same components. |

## The request paths

**Server components call `adminApi` directly.** The path never reaches the browser, so most reads
need no proxy entry at all.

**Interactions after hydration go through `/api/portal/*`**, which is an allowlist in
`lib/portalProxy.js`. A new browser call needs an explicit entry. A 404 through the proxy is the
list working.

Adding an entry has one precondition: the admin must pin every identifier in that path to the
session's own record. If it forwards a caller-supplied id, fix the admin first.

**Two dedicated routes sit outside that proxy** because they are not JSON relays: `app/api/session/*`
(sign-in, two-step code, keep-alive — they set cookies) and `app/api/intake/[id]` (the multipart
upload, with its own size and type limits).

## What the admin owns

Branding, every operator-facing string including compliance copy, which modules are enabled, and
**the action-stack ranking**. The portal owns layout, treatment per tier, countdown rendering and
empty states. It never owns what a task is or whether it is urgent.

`GET /patient/home` is screen-shaped for this reason and one other: a Redis cache of clinical
reads is storing PHI, so the available performance lever is fan-out reduction, not caching.

## Adding a screen

1. Put it under `app/(portal)/`. The layout gates the session; do not re-check it.
2. Fetch through `adminApi` in a server component. Never `fetch` the admin from a client one.
3. Handle four states — 401 as re-authentication, `409 {code: "no_linked_chart"}` as "connect your
   record" (an account with no medical record yet; key on the code, since the provider's own
   conflicts are 409s too), a failure as a calm empty state, and success.
   `components/ui/Screen.jsx` does all four; use it unless the screen genuinely differs.
4. An empty state asks for the thing that would fill it. It never reports its own absence.
