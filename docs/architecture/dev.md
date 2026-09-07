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
- which modules are enabled — approvals, labs, messaging, subscriptions, vitals
- every operator-facing string, including compliance copy
- consent policy versions and their text
- session lifetime and re-authentication rules

## Caching

`no-store` on every route. No incremental regeneration, no shared cache, no CDN. A patient's view
is never served to another request.

## Module boundaries

Each functional area (approvals, messaging, vitals, subscriptions) is independently toggleable
from the admin and must degrade cleanly when disabled — a disabled module renders nothing, never
a broken control.
