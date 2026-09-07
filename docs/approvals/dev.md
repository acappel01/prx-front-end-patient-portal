# Provider-added item approvals

The flow this portal exists to serve first.

## The scenario

A patient authorizes an amount at checkout covering an expected set of items. The provider
reviews, and may add something the patient did not originally buy. The patient accepts or declines
the addition in this portal.

**The originally authorized amount is always captured** — the patient already agreed to it. Only
the addition needs approval.

## The mechanism, and the constraint behind it

🔴 **A capture can never exceed its authorization.** Gateways permit a full or partial capture,
never an over-capture. So the addition is **not** a larger capture of the original hold — it is a
**separate charge against the vaulted card**.

| Step | Instrument | Trigger | Approval |
|---|---|---|---|
| Base | the original authorization | provider finalizes | given at checkout — always captured |
| Addition | a new charge on the vaulted card | patient accepts here | explicit, itemized |

**The provider charges. This portal never does.** Charge success and shipping eligibility are one
atomic decision inside the provider's system — an item is marked approved *only* on a successful
charge, and only an approved item ships. Charging locally and then reporting "approved" would
split that decision across a network boundary with no transaction around it.

## Client contract

| Call | Purpose |
|---|---|
| list approvals | items awaiting decision, with itemized prices and the server-computed total |
| payment methods | which stored card a charge would use — read-only |
| accept | proxies the provider's accept endpoint |
| decline | excludes the item from fulfillment |

**The server owns price.** The client echoes the total it displayed for confirmation; a mismatch
returns a conflict rather than silently charging a different amount. That catches a stale page
showing an old price.

## 🔴 Retry rules — this endpoint is not idempotent from the client's view

**Payment-required, conflict and gateway-uncertain responses are all terminal. Do not retry.**

A gateway-uncertain response means **money moved** and only the bookkeeping failed. A generic
retry-on-5xx client would re-post and re-charge, because deterministic gateway idempotency keys
genuinely dedupe on only some processors.

- Send an **idempotency key**; a repeat with the same key replays the prior outcome rather than
  charging again.
- A new attempt requires a new key.
- On an uncertain outcome, show a pending state honestly. Never imply success, and never surface
  a retry control.

## Consent evidence

Record what the patient actually saw — itemized snapshot, prices displayed, policy version,
timestamp, actor. **Not a boolean.** A consent flag with no evidence behind it is indistinguishable
from one that was never given.

## Decline

A declined item must be excluded from fulfillment. The eligibility model is a **whitelist**: an
item ships only if affirmatively approved, so a failure defaults to not shipping.

## Dependencies not yet available

| Needed | State |
|---|---|
| list / accept / decline / payment-methods | ✅ available |
| accepted and declined webhooks | ✅ available |
| order-event correlation identifiers | ✅ available |
| recording an externally-executed refund or void | ❌ **missing** |
| re-pointing an authorization reference after re-authorization | ❌ **missing** |

**Build the shell, auth and read-only views now. Hold money-touching screens** until the two
missing endpoints land — otherwise this app is written against contracts that will each move
again.
