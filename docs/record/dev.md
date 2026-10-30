# Record

The Record tab holds what a patient looks up or keeps current: orders and their shipments, the
lists a provider relies on (medications, allergies, conditions), the messages we send, a copy of
the record, past visits, and a membership if they have one. Every screen reads the admin, and the admin reads the provider with
the patient's own token. Nothing here is stored in this app.

## Screens

| Route | What it shows | Admin call | Files |
|---|---|---|---|
| `/record` | orders with a tracking link per parcel, then links to the screens below | `GET /patient/orders`, `GET /config` (modules) | `app/(portal)/record/page.jsx`, `components/record/TrackingLinks.jsx` |
| `/record/orders/{id}` | every shipment of one order, with its status and tracking | `GET /patient/orders/{id}/tracking` | `app/(portal)/record/orders/[id]/page.jsx` |
| `/record/health` | medications, allergies and conditions, each with add and remove | `GET /patient/health-record`, `POST /patient/health-record/{kind}`, `POST …/{kind}/{id}/remove`, `POST …/{kind}/search` | `app/(portal)/record/health/page.jsx`, `components/record/HealthRecordManager.jsx` |
| `/record/notifications` | a master switch and one switch per channel (email, text, in-app) | `GET` and `POST /patient/communication-preferences` | `app/(portal)/record/notifications/page.jsx`, `components/record/PreferencesForm.jsx` |
| `/record/export` | ask for a copy of the record, then download it | `POST /patient/export`, `GET /patient/export/{id}`, `GET …/{id}/download` | `app/(portal)/record/export/page.jsx`, `components/record/ExportPanel.jsx`, `app/api/export/[id]/route.js` |
| `/record/visits` | past visits, newest first | `GET /patient/encounters?per_page=50` | `app/(portal)/record/visits/page.jsx` |
| `/record/membership` | each membership: price, next payment or end date, the card, a past-due notice, and Cancel or Undo | `GET /patient/memberships`, `POST /patient/memberships/{id}/cancel`, `POST …/{id}/resume` | `app/(portal)/record/membership/page.jsx`, `components/record/MembershipCard.jsx`, `components/record/MembershipLink.jsx` |

Browser calls go through `lib/portalClient.js` and the `/api/portal` proxy. Each write is listed
in `lib/portalProxy.js`; anything not listed is refused before it leaves this app.

## Shipments

An order split across pharmacies has one shipment per pharmacy. The admin drops the pharmacy name
and the carrier before the response reaches this app, so a patient sees "Shipment 1 of 2", its
status and its tracking link, not which pharmacy filled it. When the provider returns no shipment
rows, the page falls back to the order's own tracking.

## Medications, allergies and conditions

- The admin decides which fields a patient may send, per list (`HealthRecordKind` in the admin).
  Anything else in the request is dropped, because the provider stores whatever it is handed.
- Typing a name searches the provider's terminology after a 250 ms pause. Picking a match sends
  its id, so the provider attaches the code (RxNorm, SNOMED, ICD-10). A patient never types a
  code. A name with no match is still accepted.
- Remove asks for confirmation inline.
- The whole screen is one admin module (`health_record`). Switched off, the Record link is hidden
  and the admin answers 403 `module_off`.

## Message preferences

Each switch saves as soon as it changes, and the page says "Saved." in a live region. Turning the
master switch off disables the channel switches but keeps their values, so turning it back on
restores what the patient had.

## Copy of the record

The provider builds the file in the background. The panel asks once, then checks every five
seconds until the file is ready. A second ask while one is being prepared returns the same
export. The download goes through `app/api/export/[id]/route.js`, which streams the admin's
response as an attachment named `my-health-record.json` with `no-store`, so the file never sits in
a cache. The provider's own download URL is dropped by the admin and never reaches the browser.

## Membership

A membership is bought on the storefront and billed by the admin; this screen shows it and lets
the patient stop it.

- The Record link shows only for a patient with a membership (`MembershipLink` reads the same
  list). Reading the list also attaches memberships bought with the patient's address before the
  account was verified, so a new member sees theirs on first sign-in.
- It is never a portal module and never behind two-step verification: cancelling a recurring
  charge has to be as easy to reach as joining was. The admin enforces this.
- Cancel asks once more inline, in words: no further charge, active until the end of the paid
  period (or ends now when a payment is past due), and a founding rate does not come back. Undo
  ("Keep my membership") shows until that period ends.
- Which button shows is the admin's `can_cancel` / `can_resume`; what cancel does (end of period,
  or now when past due) is the admin's `CancelMembershipAction`. This screen decides neither.
- The card is shown by brand and last four only. Changing the card is not built yet.

## What to keep true

- No clinical value in a URL or a log line. That is why terminology search is a POST with the
  term in the body: a GET would write "HIV" into the access log of this app and the admin.
- A failed write here may offer "try again", because none of them moves money (cancelling and
  undoing a membership charge nothing). Approvals are
  the exception and never offer a retry after an uncertain outcome (see
  [Approvals](../approvals/dev.md)).
