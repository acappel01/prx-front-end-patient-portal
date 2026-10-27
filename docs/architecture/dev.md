# Architecture

## Request path

```
portal browser  →  same-origin proxy (allowlisted)  →  admin  →  clinical provider
```

The browser never talks to the admin's backend directly and **never holds a provider token**. The
admin owns provider credentials, performs the patient-token exchange, and applies the per-field
privacy classification before anything clinical reaches a browser.

## What this app owns

Markup, routes, interaction, session presentation. Nothing else.

It renders a plan; it never computes one. Requirement decisions, preclusions, eligibility and
pricing are server-side. **No clinical evaluator runs in a browser.**

## What it must never contain

- a provider API token
- a hardcoded brand value, price, or piece of compliance copy
- a tracking tag of any kind
- a locally-computed clinical or pricing decision
- a locally-computed task ranking (the action stack is server-ranked — see `ux/dev.md`)
- a payment charge path for prescription items

## Configuration from the admin

The portal is a skeleton, so the admin drives:

- branding and theme tokens (shared vocabulary with the storefront)
- which modules are enabled (Settings > Patient portal). Today `messaging` (the Talk tab) and
  `vitals` (the Health tab), from `/config` `portal.modules`; a module that is false drops its tab
  (`lib/destinations.js`), and a missing key is on. Approvals, labs and subscriptions become modules
  as their screens land.
- every operator-facing string, including compliance copy
- consent policy versions and their text
- session lifetime and re-authentication rules

## Theme and logo

The admin computes the theme as CSS custom properties once, for every app that shows the brand:
`/config` `theme.tokens.vars` (`--color-primary` and its `-contrast`, `--color-background`,
`--color-text`, the colour roles such as `--color-danger` and `--color-border`, `--font-body`,
`--font-display`, `--logo-header-w`, ...). `lib/theme.js` only re-checks them (custom-property names,
no `;{}<>\` or `url(`) and `app/layout.js` puts them on `:root`. `public/scss/main.scss` maps them onto
the portal's own `--prx-*` names, each with a neutral default for an admin that sends none:

| Portal token | From the admin |
|---|---|
| `--prx-brand` / `--prx-brand-ink` | `--color-primary` / `--color-primary-contrast` |
| `--prx-urgent`, `--prx-warn`, `--prx-ok` | the Danger, Warning and Success roles |
| `--prx-bg`, `--prx-ink`, `--prx-ink-2`, `--prx-line` | background, text, Text muted and Border |
| `--prx-font-body`, `--prx-font-display` | `--font-body`, `--font-display` |
| `--prx-action` / `--prx-action-ink` | the Action role (`--color-action`), else the primary colour; the one button on a screen that commits something, and the raised Talk tab |
| `--prx-radius-sm`, `--prx-radius-md`, `--prx-radius-pill` | `--radius-*` from Corner style |

Card backgrounds stay white (`--prx-surface`): the admin's Surface role is the website's tinted band
colour, not a card colour.

**Fonts.** The admin's font stylesheet (`theme.tokens.font_stylesheet`, a Google Fonts URL) is relayed
through this origin, never linked: `/fonts/stylesheet` fetches it server-side and rewrites each font
URL to `/fonts/file/…`, which relays the file (`lib/fonts.js`). The browser never contacts Google.
Both are cached (`public`; files a year, the stylesheet a day, versioned by `tokens.version`). A
relative stylesheet path is the website's own file and is ignored here.

**Custom CSS.** Settings > Theme > Custom CSS is applied after the tokens, so a rule such as
`:root { --font-display-stretch: 118%; }` reaches the portal. `<html data-app="portal">` lets a rule
target only the portal (`[data-app="portal"] …`). CSS that loads anything is not applied (see
`security/dev.md`), and the portal logs why.

**Logo.** The signed-out pages show the brand logo (`brand.logo_light_url`, else `brand.logo_url`, from
the admin's own host) at the header logo width, and fall back to the brand name. Signed-in screens show
the same logo in the brand bar across the top (`components/shell/BrandBar.jsx`), linking home.
`brand.favicon_url` is the tab icon.

**Icons** are inline SVG (`components/ui/Icon.jsx`, Tabler outline paths, MIT), never text symbols or
an icon font: a symbol character draws as an empty box on a device whose fonts lack it.

**When the brand does not show.** The portal renders unbranded whenever `GET /config` fails, and logs
`[config] admin answered HTTP <status> on /config…`. The usual causes: `ADMIN_API_BASE_URL` points at
the storefront instead of the admin, or `ADMIN_API_TOKEN` lacks Public read while Require tokens is on.
`/config` is cached 5 minutes, so after fixing either, wait that out or clear `.next/cache/fetch-cache`
and restart.

## Caching

`no-store` on every route. No incremental regeneration, no shared cache, no CDN. A patient's view
is never served to another request.

## Module boundaries

Each functional area (approvals, messaging, vitals, subscriptions) is independently toggleable
from the admin and must degrade cleanly when disabled — a disabled module renders nothing, never
a broken control.

The admin enforces the toggles too: a call to a switched-off module answers 403 with
`code: "module_off"`, which `Screen` renders as a plain "not available" message. Modules today:
Talk, Health, and Medications, allergies and conditions (`health_record`). Approvals have no
toggle, because an added item that nobody can approve would never ship.
