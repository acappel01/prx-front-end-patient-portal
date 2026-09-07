# Security

These rules are load-bearing. Relaxing any of them reintroduces a defect that has already been
found and fixed once.

## Identity and ownership

**Chart ownership is never inferred from email equality.** A matching email address is not proof
of identity. Linking a clinical record to an account happens only after verified intake or a
provider-issued single-use claim exchange.

**Every identifier resolves from the session's own record.** Never accept a caller-supplied
encounter, prescription or order identifier as authority — resolve it from the authenticated
patient's own set and reject anything outside it. Forwarding an unfiltered request body is how a
patient ends up acting on another patient's record.

**Least-privilege abilities.** Approving a charge is a distinct ability from updating a profile.
A session may be scoped without it.

**Handle a missing ability as re-authentication, not failure.** Tokens minted before an ability
existed will lack it. Detect the authorization failure and prompt re-auth — never render a
control that is guaranteed to fail.

## Session and transport

- `no-store` and `noindex` on every route.
- Separate root layout from the storefront — this application must not inherit operator script
  injection.
- `Referrer-Policy: same-origin` on any route whose URL carries an identifier.
- No third-party script, font, or asset host on an authenticated page.

## Payment data

- The card number never reaches a server. Tokenize in the browser.
- A single-use checkout token is exchanged for a **durable vault profile** before it is used or
  passed onward; a nonce expires long before a deferred capture.
- The portal displays a stored card (brand and last four) read-only. Adding or replacing a card
  is a separate deliberate flow, never a side effect of approving a charge.

## Data minimisation

Clinical values reach the browser only where a screen renders them. Nothing clinical is logged,
sent to an analytics destination, or placed in a URL.
