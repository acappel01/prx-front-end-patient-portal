# Vitals

Three screens: **Health** (`/health`) charts and lists readings, **Log a reading** (`/health/log`) captures one,
and **Your weight goal** (`/health/goal`) sets the goal Home measures progress against. The goal lives on
the provider's chart (`/me/patient/vitals/goals` via the admin's `GET|POST /patient/vitals/goals`); the
provider keeps an existing value when a blank one is sent, so a goal or target date can be changed but
not cleared, and the form says so once a date exists.

## The field names are asymmetric, and getting them wrong fails silently

The provider takes one set of names on the way in and returns another on the way out.

| Measurement | POST as | Read back as |
|---|---|---|
| Weight | `weight_lbs` | `weight` |
| Height | `height_inches` | `height` |
| Blood pressure | `blood_pressure_systolic` / `blood_pressure_diastolic` | `systolic_bp` / `diastolic_bp` |
| Heart rate | `heart_rate` | `heart_rate` |
| Blood glucose | `blood_glucose` | `blood_glucose` |

`blood_glucose` is validated `numeric` but stored in an `integer` column, so a decimal is accepted
and silently rounded. The form offers `step="1"` rather than promising a precision the provider
will discard. Weight is genuinely decimal upstream and keeps its.

Neither mistake announces itself. Posting the response names validates clean and stores an empty
row; reading the request names renders blank rows from real data. **Both have shipped here.** The
form's names come from the provider's handler, not from its resource DTO and not from the list
this app renders — check the live payload before changing either side.

`recorded_at` is deliberately not sent: the provider does not accept it, and every row is timestamped
`created_at`.

## A save can fail after it has succeeded

`POST /me/patient/vitals` used to **insert the row and then crash** on every call (upstream P0-7).
The provider fixed that on its sandbox on 2026-09-13 (not yet on its production). The rule this
screen is built on stands regardless: once the insert commits, any later failure — a timeout, a
dropped connection, a database error on the re-read — reports an error for a row that exists.

So the natural response to an error — press the button again — writes a second reading, and the
duplicate lands in the trend the Health screen exists to draw. Self-reported weight is the main
reason a patient opens a portal between visits, which makes this the one dataset the product can
least afford to corrupt.

`VitalsForm` therefore branches on **status**, not on success:

| Outcome | Copy | Retry offered? |
|---|---|---|
| `201` | "Reading saved." plus, when both readings have a weight, the change since the last one (`change_from_last`: "2.4 lbs down since your last reading, 7 days ago"). `period_days` arrives as a **fraction** (Carbon 3) and is floored. | — |
| `401` | Session expired, sign in again. | — |
| `422` | Names the field. Values are kept. | **Yes** — nothing was written. |
| anything else | "We couldn't confirm that reading. It may still have been saved…" | **No.** No button, no filled form. |

The unconfirmed screen does not say *try again*, does not claim the reading was lost, and offers
exactly one way out: **Check my readings**. Telling the patient the truth and pointing them at the
data is the only honest option whenever the outcome is unknown.

That is also why the Health list renders every measurement rather than only weight, and localises
its timestamps: it is the destination of that message, so it has to be legible enough to answer
"is the reading I just took in here?".

A `401` reaching this form always means *our* session, never the provider's: the admin maps an
upstream 401 to 502 precisely so this screen cannot tell a patient to sign in again over a
credential they do not hold.

## The status distinction is not free

It exists only because the admin stops collapsing upstream failures into one 500 — see
`atlas-protocol-admin/docs/portal/dev.md`, *Upstream failures keep their status*. Two layers on
this side then have to carry the 422's `errors` array through: `lib/adminApi.js` unwraps it from
the envelope, and the proxy route forwards it on a failure. **Dropping it anywhere in that chain
turns "check the weight" back into "something was wrong", which is indistinguishable from the
failure that must not be retried** — and it dropped silently for exactly that reason once.

## Times

`created_at` carries a real UTC offset, so it names one instant and `components/ui/LocalTime.jsx`
formats it in the reader's own timezone on mount. The server renders the raw ISO string first, so
there is no hydration mismatch and no server-timezone guess.

**A naive timestamp must never go through that component.** It has no instant to convert, and
guessing one is upstream P0-9 — visits landing exactly one offset off.

## Charts

`/health` makes one call, the admin's `GET /patient/health/series?period=1year|all`, which returns the
chart series (weight, blood pressure, heart rate, blood glucose — oldest first, exact instants), the
weight goal, and the newest 50 readings for the list. The period lives in the URL (`?period=all`);
**Past year** is the default and **All time** shows a continuing patient's whole history — nothing is
lost by the shorter view, because the history stays with the provider.

`components/charts/TrendChart.jsx` is hand-rolled SVG, rendered on the server, and is the swap boundary:
a deployment that wants a charting library replaces that file and keeps its props. Rules it follows,
from the portal framework spec:

- **Every chart carries its target** — the weight goal is a dashed line in the fixed `--prx-ok` colour (the spec calls it `--prx-gain`),
  labelled in place, drawn even when the series is short. A brand colour never marks the target.
- **The endpoint is emphasised** — a ringed dot on the latest reading — and one plain sentence under the
  chart ("Up 16.6 lbs across these readings. 10.6 lbs above your goal of 185 lbs.") says what the line
  means. Against the goal it states only where the latest reading sits ("10.6 lbs above your goal"),
  never a guessed direction: the window's first reading is not where the patient started, and inferring
  it once told a patient 10 lbs above their goal that they had reached it.
- **Time is proportional**: three months without a reading looks like three months. The first and last
  dates render through `LocalTime format="date"`, in the reader's timezone.
- **Colour is never the only signal**: the two blood-pressure lines differ in dash as well as colour, and
  the goal is labelled.
- **Empty asks for the reading**: no weight yet shows "Log your weight"; a weight without a goal offers
  "Set a goal".

Blood pressure, heart rate and glucose charts appear only once a reading of that kind exists. When the
provider returned 1000 readings (the admin's cap), a line says the charts show the most recent ones.
