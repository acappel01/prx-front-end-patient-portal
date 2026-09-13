# Interface and information architecture

**Mobile-first. 390 × 812 is the design baseline**, not a breakpoint to degrade into. Desktop is
the reflow.

## What this portal is

A **white-label patient portal** for groups running their own frontend. It consumes the platform
API and, for those groups, **replaces** any portal shipped by the clinical provider.

That has one hard consequence worth stating before the design details:

> 🔴 **API-only is a constraint, not a deployment detail.** Any capability that exists only inside
> a provider's own monolithic portal — a Livewire screen, a server-rendered flow, a session-bound
> action — is unavailable to a white-label group unless there is an API for it. Every feature
> gap is therefore an adoption blocker, and the fix is an endpoint, never a workaround here.

Maintain an **API-parity list**: for each capability a patient needs, the endpoint that provides
it. Known gaps at the time of writing are recorded in `approvals/dev.md`.

## The organising principle

> **The portal opens with what you owe it, not with everything it holds.**

A patient arriving has one question — *what do I do now, and is it working?* — and the interface
answers it before showing anything else.

## Six failure modes to review against

Adopted as review criteria. Each has been observed in a real patient portal.

| Failure | What it looks like |
|---|---|
| **Flat hierarchy** | Everything is a card of equal weight. A blocked prescription is styled exactly like a BMI reading. |
| **Buried actions** | The highest-value action sits behind a hamburger, two taps and a scroll away. |
| **Silent urgency** | A visit starting in four minutes renders identically to one three weeks out. |
| **Empty by default** | Tiles that say "No data yet" occupy prime space advertising emptiness, and never ask for the reading that would fill them. |
| **Chart-as-admin-table** | Thirteen tabs and rows keyed by internal identifiers — a clinician's tool shown to a patient. |
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
- **Record** — orders, vitals, documents, profile, payment, sign out

Desktop reflows the **same components** and the **same five destinations**; the tab bar becomes
an icon rail. Never a different IA per breakpoint.

⚠️ Which destinations appear is a **deployment setting** — a group not using labs should not ship
an empty Health tab. The five above are the default, not a fixed set.

## The action stack

Tasks are **ranked**, not listed in source order. Ranking is the feature.

| Tier | Contains | How it reads | Treatment |
|---|---|---|---|
| **0 · Live** | a visit joinable now, or within ±15 minutes | *"Your provider is in the waiting room"* + live countdown | Solid fill, pulsing indicator. **Maximum one per screen.** |
| **1 · Blocking** | unfinished intake, information requested, an order awaiting approval | the task **and why it matters** | White card, brand border, filled button, completion meter |
| **2 · Time-boxed** | items with an expiry, pending lab action, an appointment inside 48h | **always the deadline, never a date** | Amber wash, outlined button. Countdown is a chip, not body copy. |
| **3 · Routine** | new results, dose due, surveys, reassessments | *"2 routine items · lab kit, dose log"* | One collapsed dashed row. Expands on tap. **No colour.** |

**Sort:** tier ascending, then soonest deadline first.

Rules that make it work:

- **Colour is reserved for urgency.** If routine items carry colour, tier 0 stops meaning anything.
- **One tier-0 item maximum.** Two live emergencies is a design failure, not a state to render.
- **Deadlines, not dates.** "Expires in 3 days" is actionable; a timestamp makes the patient do
  arithmetic.
- **A blocking item always says why.** "Finish your intake" is a chore; "your provider can't
  review your screening until this is submitted" is a reason.
- **Empty state is success.** No pending tasks means "you're up to date", never a grid of
  "No data yet" tiles.

## 🔴 Ranking is server-side, and it is deployment policy

The tiers, their triggers and the sort are **clinical and commercial policy**, not presentation.
Computing them in the browser guarantees drift the first time a rule changes, and makes the
policy unauditable.

**The admin ranks.** It composes clinical state read from the provider API with the deployment's
own configuration, and serves this portal a ranked list. The portal renders it.

This matters more here than in a single-tenant portal: two white-label groups may legitimately
disagree about what is urgent — one surfaces lab kits aggressively, another does not — and that
difference is configuration, not a fork.

The portal owns: layout, treatment per tier, countdown rendering, expand/collapse, empty states.
The portal never owns: what a task is, which tier it belongs to, or whether it is urgent.

## Content rules

- **Lead with the answer.** The dose above the safety copy. Safety text is present and accessible,
  never the first thing between a patient and what they came for.
- **Re-cut the record for a patient** — group by what they recognise (their treatment, results,
  orders, profile), not by encounter rows keyed by internal identifiers.
- **Ask for the reading rather than reporting its absence.** An empty weight tile is a prompt.
- **Only show tools the prescription calls for.** A fixed-dose ready-to-inject prescription shows
  no reconstitution or titration UI.
- **All compliance and clinical copy comes from the admin.** Nothing that carries a claim, a
  policy or a price is compiled in.
- 🔴 **UI chrome strings currently ARE compiled in** — button labels, empty states, field labels,
  error copy. Every screen in this app does it. That is a known gap, not the intent: this is a
  white-label skeleton, so a second deployment cannot yet change "Log a reading" or translate
  anything without a code change. Closing it needs a content layer in the admin and is an open
  decision, not something to fix screen by screen. Do not extend it to anything clinical.

## Forms

- **Every control is wrapped in `.prx-field`.** A bare `<label>` and `<input>` are both inline
  boxes, so without it they share a line: the sign-in screen rendered as `Email[box]Password`
  with the password field beside the button, at the one width this app is designed for.
- **Ask for the one measurement first, and fold the rest away.** Five empty inputs above the
  button turn a ten-second action into a scroll. `/health/log` shows weight and a `<details>`
  disclosure; a native `<details>` gets keyboard and screen-reader behaviour for free and works
  before hydration. Give the summary a visible marker — the browser default reads as bold text,
  not as something you can press.
- **A disclosure opens itself when something inside it needs attention**, so a validation error
  can never point at a field that is folded away. This must be written **imperatively** — set
  `.open` in an effect. `<details open={...}>` writes the DOM only when the prop *changes*, so
  after a manual collapse the element and React disagree and the same prop value is a no-op: the
  form rejects a submission and hides the reason, which looks exactly like a button that does
  nothing.
- **Inputs never go below 16px**, or iOS zooms the viewport on focus and the patient is left
  scrolling a form they can no longer see all of.
- **One control per row**, with one exception: blood pressure, which every patient has been
  taught to read as one number over another.
- **Branch failure copy on the STATUS, not on success.** A rejected value and a write that
  crashed after committing need opposite instructions, and only one of them may offer a retry.
  See `vitals/dev.md` — the vitals endpoint did both, and the rule stands.

## Accessibility and touch

- Real `<button>` elements for every interactive control. No click handlers on `<li>` or `<span>`.
- Minimum 44 × 44 px touch targets; the tab bar respects safe-area insets.
- One shared focus-trap implementation for every overlay; Escape closes; focus returns to origin.
- Countdowns update through an accessible live region, not by silently repainting text.
- Colour is never the only signal — a time-boxed item carries a text deadline as well.

## Charting

Trends are first-class, not decoration. A chart states its conclusion in text — *"loss steepened
after each titration"* — because a patient reads the sentence, not the axis.

Render from API-supplied series. The charting library is a deployment choice behind a swappable
component boundary, never a hardcoded dependency.

## On reference designs

A portal redesign produced for a provider's own monolithic product informed the failure modes,
the five-destination layout and the tier model above. **It is a design reference, not a
specification.** That product is server-rendered and single-tenant; this one is API-only and
multi-brand, so its screens, components and internal services do not carry over.

Where a reference design assumes direct database or session access, the equivalent here is an
endpoint — and if that endpoint does not exist, it belongs on the API-parity list rather than
being worked around in the browser.
