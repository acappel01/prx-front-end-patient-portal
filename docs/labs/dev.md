# Lab results

Lab results live on the Health tab. The admin reads them from the provider with the patient's own
token, decides what each value means (critical, outside range, in range), drops what a patient must
not see, and picks the featured values. This app lays them out. Nothing is stored here.

## Screens

| Route | What it shows | Admin call | Files |
|---|---|---|---|
| `/health/labs` | a critical notice, a "not yet reviewed" notice, the featured values as tiles, every value (tap to open its chart and history), then the lab orders | `GET /patient/labs` | `app/(portal)/health/labs/page.jsx` |
| `/health/labs/{id}` | one order: each test, its values with the normal range and flag, and notes the provider wrote for the patient | `GET /patient/labs/{id}` | `app/(portal)/health/labs/[id]/page.jsx` |
| `/health` | links to Lab results when the `labs` module is on; redirects to `/health/labs` when health tracking (`vitals`) is off | `GET /config` | `app/(portal)/health/page.jsx` |

Shared pieces:

- `components/labs/LabFlag.jsx`: the badge. Word, glyph and colour, never colour alone.
- `lib/labs.js`: wording (`flagOf`, `rangeText`, `changeText`, `formatValue`). It words the admin's
  verdict and never says whether a value is good or bad for the patient.
- `components/charts/TrendChart.jsx`: the same chart as Health, with `band` (the normal range,
  shaded and labelled, either end may be open), `marks` (every reading drawn by severity) and
  `bare` (no visible heading inside a row that already shows it).

The Health tab shows while `vitals` or `labs` is on (`lib/destinations.js`).

## Rules

- **Critical is words, not a colour.** A notice says the care team has been alerted and will
  review it, and gives the emergency line. It never interprets the value or gives medical advice.
  Home carries the same message as a task until the provider reviews the results; the admin
  decides that task.
- **Unreviewed results say so.** The provider releases values once results are received, before
  review. Every screen showing them says "not yet reviewed".
- **Nothing before release.** Before an order's results are in, the admin sends no values and no
  flags, so the list cannot hint that something is wrong.
- **Nothing clinical in a URL.** Values open in place (`<details>`). Tiles link to `#b-<key>` on
  the same page; a fragment never leaves the browser. Orders are addressed by id only.
- **Dates are calendar dates.** A lab date is formatted in UTC so it never shifts a day in the
  reader's timezone.

## Admin contract

See the admin's [Patient portal developer reference](https://github.com/acappel01/PRX-Client-Backend-Framework/blob/main/docs/portal/dev.md#lab-results)
for the payload. `severity` is `critical`, `abnormal`, `normal` or `unknown`; `direction` is
`high`, `low` or null; `value` is as the lab wrote it and `numeric` is what can be charted.
