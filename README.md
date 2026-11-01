# prx-front-end-patient-portal

**White-label patient portal.** For groups running their own frontend and consuming the platform
API only — it **replaces** the portal shipped by the clinical provider's own product.

One of three applications:

| App | Role |
|---|---|
| **Admin** (Laravel + Filament) | Source of truth — clinical records, transactions, integrations, attribution |
| **Storefront** | Anonymous public commerce and marketing |
| **Patient portal** (this repo) | Authenticated clinical views, approvals and account management — API-only, brand-neutral |

## Why this is a separate application

It is **not** a route inside the storefront, deliberately.

The storefront injects operator-pasted tracking snippets unsanitized — that is a documented
feature and correct for a marketing surface. If the portal shared that shell, third-party scripts
would execute on pages rendering prescriptions and patient identifiers.

Separating the applications removes that structurally rather than relying on every future
operator not to paste a tag. The two also have opposite caching postures (cached vs never-cached),
opposite indexing, and independent release cadence.

## API-only is a constraint, not a detail

Any capability that exists only inside a provider's own server-rendered portal is unavailable to
a white-label group unless there is an API for it. **Every such gap is an adoption blocker**, and
the fix is an endpoint — never a workaround in this app. See the API-parity note in
[`docs/ux/dev.md`](docs/ux/dev.md).

## Mobile-first

**390 × 812 is the design baseline**, not a breakpoint to degrade into. Desktop reflows the same
components and the same five destinations. See [`docs/ux/dev.md`](docs/ux/dev.md).

## Non-negotiables

- **No browser tracking tags. Ever.** No pixel, no tag manager, no session replay, no chat widget.
- **`no-store` and `noindex` on every route.**
- **Never holds a clinical-provider token.** The portal calls the admin; the admin calls the
  provider. One credential boundary, one audit point.
- **Ownership is never inferred from an email match.** Every identifier resolves from the
  session's own record.

## Documentation

| Path | Audience | Tracked |
|---|---|---|
| `docs/` | developers and operators — shipped documentation | ✅ yes |
| `agent-docs/` | plans, runbooks, handoff, analysis | ❌ **gitignored, local only** |

Agent configuration files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.claude/`, `.codex/`, …) are
gitignored. Nothing agent-authored ships in this repository.

Start with [`docs/README.md`](docs/README.md).

## What it does today

- **Account:** sign in with two-step verification and trusted browsers, create an account and
  reset a password from emailed links, connect a medical record (`/connect`), sign-in history.
- **Home:** the server-ranked action stack (visits, held information, approvals, lab results).
- **Care:** prescriptions, items the provider added for the patient to approve or decline, and
  the information a held visit is waiting on (including photo uploads).
- **Talk:** message threads with the care team, polled.
- **Health:** readings and trends, a weight goal, and lab results with flags and charts.
- **Record:** orders and every shipment, past visits, medications, allergies and conditions,
  message preferences, a downloadable copy of the record, and memberships (cancel and undo).

The admin can switch off Talk, health tracking, lab results and the health record lists. Two
provider endpoints are still missing for brands that charge on their own gateway (recording an
external refund or void, and re-pointing an authorization reference); see
[`docs/approvals/dev.md`](docs/approvals/dev.md). Nothing in the portal depends on them today.

## Run it

```bash
cp .env.example .env      # ADMIN_API_BASE_URL (the admin, plus /api/v1), SESSION_SECRET and PORTAL_URL (this app's origin)
npm ci
npm run dev
```

Every variable, and what the admin needs set to match, is in
[`docs/getting-started/dev.md`](docs/getting-started/dev.md). For production, `npm run build` then
`npm run start` behind a reverse proxy, as for the storefront.

## Fork

Fork this along with PRX-Client-Backend-Framework https://github.com/acappel01/PRX-Client-Backend-Framework 
which contains the complete documentation set to allow a full trifecta of Admin/Patient Portal/Complete Ecommerce Front End

