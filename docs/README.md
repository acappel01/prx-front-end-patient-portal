# Documentation

**Shipped documentation only** — developer guides (`dev.md`) and operator guides (`user.md`).
Tracked and readable by anyone with repository access.

Plans, runbooks, handoff notes, analysis and memory files belong in `agent-docs/`, which is
gitignored. Do not add them here.

| Area | Developer | Operator |
|---|---|---|
| [Interface & IA](ux/dev.md) | mobile-first layout, navigation, the action stack | — |
| [Architecture](architecture/dev.md) | structure, boundaries, what this app may not own | — |
| [Security](security/dev.md) | session, scoping, the rules that cannot be relaxed | — |
| [Approvals](approvals/dev.md) | the provider-added item accept/decline flow | [operator guide](approvals/user.md) |
| [Tracking](tracking/dev.md) | why conversions fire server-side only | — |
| [Vitals](vitals/dev.md) | capture and list, and why a failed save never offers a retry | — |

- [`getting-started/dev.md`](getting-started/dev.md) — stack, how to run it, where things live, how to add a screen
