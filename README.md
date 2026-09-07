# prx-front-end-patient-portal

Authenticated patient portal for the Prescribe-Rx platform. One of three applications:

| App | Role |
|---|---|
| **Admin** (Laravel + Filament) | Source of truth — clinical records, transactions, integrations, attribution |
| **Storefront** | Anonymous public commerce and marketing |
| **Patient portal** (this repo) | Authenticated clinical views, approvals and account management |

## Why this is a separate application

It is **not** a route inside the storefront, deliberately.

The storefront injects operator-pasted tracking snippets unsanitized — that is a documented
feature and correct for a marketing surface. If the portal shared that shell, third-party scripts
would execute on pages rendering prescriptions and patient identifiers.

Separating the applications removes that structurally rather than relying on every future
operator not to paste a tag. The two also have opposite caching postures (cached vs never-cached),
opposite indexing, and independent release cadence.

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

## Status

Documented ahead of code. The shell, auth and read-only views are unblocked and can start now;
money-touching screens wait on two provider endpoints that do not yet exist (external reversal
recording, and re-pointing an authorization reference). See `docs/approvals/dev.md`.
