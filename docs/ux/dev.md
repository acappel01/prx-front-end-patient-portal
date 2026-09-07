# Interface and information architecture

**Mobile-first. 390 × 812 is the design baseline**, not a breakpoint to degrade into. Desktop is
the reflow.

This document records the agreed IA. It is derived from the portal redesign proposal produced on
the clinical-provider side, and the two implementations must share this structure even though
they do not share code (see *Two portals* below).

## The organising principle

> **The portal opens with what you owe it, not with everything it holds.**

Everything below follows from that. A patient arriving at the portal has one question — *what do
I do now, and is it working?* — and the interface answers it before it shows anything else.

## Six failure modes this design exists to avoid

Each was observed in a real portal. Treat them as review criteria, not history.

| Failure | What it looks like |
|---|---|
| **Flat hierarchy** | Everything is a card of equal weight. A blocked prescription is styled exactly like a BMI reading. |
| **Buried actions** | The highest-value action in the product sits behind a hamburger, two taps and a scroll away. |
| **Silent urgency** | A visit starting in four minutes renders identically to one three weeks out. |
| **Empty by default** | Tiles that say "No data yet" occupy prime space advertising emptiness, and never ask for the reading that would fill them. |
| **Chart-as-admin-table** | Thirteen tabs and a row of internal identifiers — the provider's tool, shown to the patient. |
| **Buried lede** | Safety boilerplate above the dose. The patient opened the page to read *inject 20 units, weekly*. |

## Navigation — five destinations

A persistent bottom tab bar with a **raised centre action** for the consult path.

```
   Home        Care      ( Talk )      Health      Record
```

- **Home** — the action stack and today's essentials
- **Care** — active treatment, appointments, consults
- **Talk** — raised centre button; the consult path, never a submenu item
- **Health** — progress, goals, biomarkers and trends
- **Record** — orders, vitals, documents, profile, payment

**Desktop reflows the same components** to a two-column layout; the tab bar becomes an icon rail.
**The rail and the tab bar are the same five destinations** — never a different IA per breakpoint.

## The action stack — the core of the Home screen

Tasks are **ranked**, not listed in source order. Ranking is the feature.

| Tier | Contains | How it reads | Treatment |
|---|---|---|---|
| **0 · Live** | a visit joinable now, or within ±15 minutes | *"Dr. — is in the waiting room"* + live countdown | Solid fill, pulsing indicator, white button. **Maximum one per screen.** |
| **1 · Blocking** | unfinished intake, information requested, an order awaiting approval | the task **and why it matters** | White card, brand border, filled button, completion meter |
| **2 · Time-boxed** | items with an expiry, pending lab action, an appointment inside 48h | **always the deadline, never a date** — "Expires in 3 days" | Amber wash, outlined button. The countdown is a chip, not body copy. |
| **3 · Routine** | new results, dose due, surveys, reassessments | *"2 routine items · lab kit, dose log"* | One collapsed dashed row. Expands on tap. **No colour.** |

**Sort:** tier ascending, then soonest deadline first.

Rules that make this work:

- **Colour is reserved for urgency.** If routine items carry colour, tier 0 stops meaning anything.
- **One tier-0 item maximum.** Two live emergencies is a design failure, not a state to render.
- **Deadlines, not dates.** "Expires in 3 days" is actionable; "expires 2026-09-10" requires the
  patient to do arithmetic.
- **A blocking item always says why.** "Finish your intake" is a chore; "Dr. — can't review your
  screening until this is submitted" is a reason.
- **Empty state is success, not absence.** No pending tasks means "you're up to date", never a
  grid of "No data yet" tiles.

## 🔴 The ranking is business logic — do not reimplement it here

The tiers, their triggers and the sort are **clinical and commercial policy**, not presentation.
Reimplementing them in the browser guarantees drift the first time a rule changes.

The provider exposes a patient action-stack endpoint backed by a single ranking service. **This
portal consumes that ranking and renders it.** It does not classify tasks, compute tiers, or
decide what is urgent.

The frontend owns: layout, treatment per tier, countdown rendering, expand/collapse, and empty
states.

## Content rules

- **Lead with the answer.** The dose above the safety copy. Safety text is present and accessible,
  never the first thing between a patient and what they came for.
- **The record is re-cut for a patient**, not a table of encounters keyed by internal identifiers.
  Group by what a patient recognises: their treatment, their results, their orders, their profile.
- **Ask for the reading rather than reporting its absence.** An empty weight tile is a prompt to
  log a weight.
- **Only show tools the prescription calls for.** A fixed-dose ready-to-inject prescription does
  not show reconstitution or titration.

## Accessibility and touch

- Real `<button>` elements for every interactive control. No click handlers on `<li>` or `<span>`.
- Minimum 44 × 44 px touch targets; the tab bar respects safe-area insets.
- One focus trap implementation shared by every overlay; Escape closes; focus returns to origin.
- Countdowns update via an accessible live region, not by silently repainting text.
- Colour is never the only signal — a tier-2 amber wash carries a text deadline as well.

## Two portals — and why the contract is shared, not the code

The provider is shipping a Bootstrap/Livewire portal against its own stack. This repository is a
brand-neutral portal for platform deployments.

**Share:** this IA, the tier model and its triggers, the content rules, and the action-stack
contract.
**Do not share:** components or stylesheets. They target different stacks and different tenancy
models.

Where the two disagree about *what is urgent*, the ranking service is the answer for both —
which is exactly why the ranking must not live in either frontend.

## Charting

Trends (weight, biomarkers, adherence) are first-class, not decoration. A chart states its
conclusion in text — *"loss steepened after each titration"* — because a patient reads the
sentence, not the axis.

Charting library is a deployment choice, not a hardcoded dependency; render from API-supplied
series and keep the component boundary swappable.
