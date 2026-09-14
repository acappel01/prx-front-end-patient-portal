# Local commerce history

`/record/purchases` lists orders placed through this site and explicitly connected to the signed-in account. `/record/purchases/[uuid]` shows that order's item and shipment snapshots. Record links to this history while keeping its existing `/patient/orders` clinical projection and account controls. The two histories can overlap; they are not combined or deduplicated, and neither is presented as complete imported provider history.

Both pages are dynamic server components. They require the existing signed session before calling `adminFetch` with its Patient token. No browser API proxy entry, token storage, machine-token fallback or chart lookup is added. The admin owns the Customer/order authorization. A commerce account does not need an independently linked clinical chart to request its eligible local orders.

The list calls `GET /orders?page=N&per_page=20`. Page input is a single integer from 1 through 10,000; other query parameters never reach the admin. Pagination URLs are constructed locally from validated numeric metadata, never followed from upstream `links`. The list uses the admin's compact summary and scoped count. Offset pages may shift as new orders arrive. The detail path accepts a complete hexadecimal UUID only and calls `GET /orders/{uuid}`. Invalid identifiers do not produce API requests.

Session expiry prompts sign-in. Missing abilities offer the existing sign-out action before sign-in, avoiding a loop through a still-valid session. Required two-factor setup redirects to `/record/security?required=1`. Inaccessible detail returns the same unavailable-for-account message regardless of whether the order exists. Rate limits, invalid pages, malformed responses and network failures do not become empty history. `Screen` also catches transport exceptions so a failed clinical request on Record does not remove the local history navigation.

Amounts retain the recorded currency and are labeled order totals, never collected payments or revenue. Missing amounts are shown as not recorded. Dates use the existing local-time component. Item and shipment fields are explicitly rendered; no raw response, metadata, address snapshot or chart identity is shown. Carrier links accept HTTPS only without embedded credentials and open with `noopener noreferrer` and a no-referrer policy.

The existing shell supplies no-store/noindex and session/2FA handling remains administered upstream. No provider API, tracking script, marketing event or payment mutation is introduced.

## Validation

`npm test` runs fixture-only Node tests for request paths, pagination, response/error states, detail identity validation, currency formatting and tracking URL restrictions. No API credentials or network are needed. Run a production build separately in an isolated checkout with the supported Node version. Deployment requires the matching admin Customer-owned list/detail API and remains a separate action.

September 14 qualification: seven fixture tests and an isolated production build passed with outbound network blocked. A separate built-app HTTP smoke run used only synthetic signed sessions and two allowlisted loopback servers. It exercised list/detail/pagination, anonymous redirect without an order request, inaccessible order, required 2FA, expired session, backend 503/connection failure versus empty data, and Record navigation during clinical transport failure. HTML/headers were checked for no-store/noindex and absence of fake bearer tokens, admin host and private fixture fields. No served environment or provider was accessed. Astra independently reviewed the routes, helpers, session usage and failure handling.
