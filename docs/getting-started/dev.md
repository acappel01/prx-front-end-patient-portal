# Getting started

## Stack

Next.js 15 App Router · React 19 · Sass. No CSS framework, no component library, no charting
dependency yet — the charting library is a deployment choice behind a swappable component
boundary, so it is not a dependency of the skeleton.

Chosen to match the storefront skeleton so one team can move between the two, and because the
App Router's server components are what keep clinical data out of the browser bundle by default.

## Run it

```bash
cp .env.example .env      # fill in ADMIN_API_BASE_URL and SESSION_SECRET
npm ci
npm run dev
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

## Layout

| Path | What lives there |
|---|---|
| `app/layout.js` | Universal shell. Puts the admin's theme tokens on `:root` (see `architecture/dev.md` → Theme and logo). No script tag, no third-party host. |
| `app/(portal)/` | The authenticated tree. Its layout is the single session gate. |
| `app/login/` | Anonymous. Bounces to `/` only a session the admin still accepts (`/patient/auth/me`), never on the cookie's signature alone. |
| `app/claim/[token]/` | Anonymous. Lands a claim link; signs in in place. |
| `app/register/`, `app/forgot/` | Anonymous. Email-only forms that ask the admin to email a link. No account is created here. |
| `app/create-account/[token]/`, `app/reset/[token]/` | Anonymous. Land the emailed links; a password form, token spent only on submit. |
| `app/api/account/{link,create,reset}/` | The three anonymous account calls. Outside the proxy, which needs a session. |
| `app/fonts/` | The admin's brand fonts, relayed so no patient page loads from Google (`lib/fonts.js`). |
| `app/api/session/` | Sign in and out. Exchanges a credential for an admin token server-side. |
| `app/api/portal/[...path]/` | Same-origin proxy — **allowlisted**, never a passthrough. |
| `app/api/intake/[id]/` | The one multipart upload (what a held visit needs): capped, whitelisted, rebuilt — see `security/dev.md` → Uploads. |
| `lib/` | `adminApi`, `session`, `portalProxy`, `theme`, `fonts`, `destinations` (server-only), and `format` (money and word helpers for display). |
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
