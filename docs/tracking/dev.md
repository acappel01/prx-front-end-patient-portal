# Tracking and attribution

## The rule

**No browser tracking tag ever runs in this application.** No pixel, no tag manager container, no
session replay, no analytics snippet, no chat widget.

Three independent reasons, any one sufficient:

1. **Compliance.** A browser tag on a page rendering prescriptions collects the page URL and
   referrer automatically, and in some configurations scrapes form fields — none of which was
   chosen deliberately. The marketing destinations this platform integrates with do not sign
   business associate agreements.
2. **Accuracy.** Ad blockers and browser privacy controls degrade browser capture substantially.
   Server-side reporting is measurably more complete, not a compromise.
3. **Control.** Server-side, the exact field list leaving for each destination is explicit and
   provable.

## Why this costs nothing

**Every money event in this application is already a server event.** A base capture arrives as a
gateway webhook plus a provider order event; an accepted addition arrives as an approval webhook.
The admin fires conversions from those signals.

So the portal needs no tag to be fully tracked and attributed.

## Attribution

Attribution is resolved by the admin from the **record**, never from a browser.

A portal session typically happens days or weeks after the original click, often on a different
device. Referral cookies are host-scoped and short-lived and frequently absent in that context.
Reading them here would silently drop the affiliate's credit.

The original click's campaign and referral identifiers are snapshotted onto the purchase record at
creation, and every conversion event reads them from there. A portal transaction therefore
attributes to whoever earned the original click — which is the correct commercial answer, and is
only achievable because attribution rides the record.

## What this app must not do

- add any analytics or advertising script
- put an identifier, medication name or clinical value in a URL, log or outbound payload
- read or write a marketing cookie
