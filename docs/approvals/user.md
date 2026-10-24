# Approvals — operator guide

## What a patient sees

When a provider adds an item that was not part of the original purchase, the patient is shown the
item, its price, and the card that would be charged. They accept or decline.

- **Accepting** charges only the added item, immediately.
- **Declining** removes it. It will not be dispensed or shipped.
- The **original purchase is charged regardless** — the patient already agreed to it at checkout.
  Only the addition requires a decision.
- **Doing nothing counts as declining.** The patient has 48 hours. After that the original order
  ships without the added item, and the item is not charged. The portal's Home screen shows the
  task with a countdown until then.

## Two charges on one order can be correct

⚠️ **Read this before issuing a refund.**

A single order can legitimately produce more than one charge:

| Charge | When | By |
|---|---|---|
| Non-prescription items | at checkout | the storefront |
| Prescription items | when the provider finalizes | the clinical provider |
| A provider-added item | when the patient accepts it | the clinical provider |

So a patient reporting "I was charged twice" is often describing **expected behaviour**. Check the
order's charges before refunding — refunding a correct charge creates a reconciliation break that
is harder to unwind than the original complaint.

## When an item is charged but has not shipped

An accepted addition is charged first and routed to fulfillment as a separate step. If an item
sits in that state, it needs someone to route it — it will not move on its own.

**This queue needs an owner and needs watching.** Money has been taken and the customer is
waiting.

## When an outcome is uncertain

Occasionally a charge succeeds but the record of it fails to save. The patient sees a pending
state rather than a confirmation, and the item is flagged for reconciliation.

**Do not ask the patient to try again** — that risks a second charge. Escalate for reconciliation
instead.

## Declines

A declined item is removed from fulfillment automatically. No operator action is required.
