/**
 * What an answer to "approve / decline this item" means for the patient, and
 * whether they may try again.
 *
 * Approving charges a card, so the rule is narrow on purpose: a retry (with a
 * NEW idempotency key) is offered only when the admin answered `code: 'error'`,
 * the one outcome where it knows nothing was charged. Everything else that is
 * not a clear answer — a dropped connection, a 5xx without a code (a 502/504
 * from the web server in front of a slow gateway), the proxy's
 * `upstream_unreachable`, a code this screen does not know — is `uncertain`:
 * money may have moved. The screen keeps the same key, offers no retry, and
 * says the payment may still be processing.
 *
 * The codes are the admin's `PatientApprovalOutcome`
 * (`ApprovalController::accept` documents them): 200 `charged` / `declined`,
 * 202 `uncertain`, 402 `payment_required` / `gateway_declined`, 409
 * `price_mismatch` / `already_resolved`, 502 `error`.
 *
 * Pure: no React, no fetch. `response` is portalCall()'s result.
 */

/** Definite refusals: the admin knows nothing was charged, but trying again cannot help. */
const SETTLED = ['payment_required', 'gateway_declined', 'price_mismatch', 'already_resolved'];

const DONE = ['charged', 'declined'];

export const UNCERTAIN_MESSAGE = {
  accept:
    'We could not confirm the payment, and it may still be processing. Please do not try again. Check back on this page later, or contact support if it does not update.',
  decline:
    'We could not confirm your answer. Check back on this page later to see whether it was recorded, or contact support.',
};

const SETTLED_MESSAGE = 'This item could not be approved. Reload the page to see where it stands.';

export const ERROR_MESSAGE = 'Something went wrong. Nothing was charged. Please try again.';

/**
 * @returns {{ outcome: string, retry: boolean, uncertain: boolean, message: string, reference: string|null }}
 */
export function approvalOutcome(response, decision = 'accept') {
  const reference = response?.requestId ?? null;

  const uncertain = (message) => ({
    outcome: 'uncertain',
    retry: false,
    uncertain: true,
    message: message ?? UNCERTAIN_MESSAGE[decision] ?? UNCERTAIN_MESSAGE.accept,
    reference,
  });

  if (response?.ok) {
    const outcome = response.data?.outcome;

    if (DONE.includes(outcome)) {
      return { outcome, retry: false, uncertain: false, message: response.data?.message ?? response.message ?? '', reference: null };
    }

    // The admin's own 202 `uncertain` carries its sentence; an outcome this
    // screen does not know is uncertain too, in our words.
    return uncertain(outcome === 'uncertain' ? (response.data?.message ?? response.message ?? undefined) : undefined);
  }

  if (response?.code === 'error') {
    return { outcome: 'error', retry: true, uncertain: false, message: response.message ?? ERROR_MESSAGE, reference };
  }

  if (SETTLED.includes(response?.code)) {
    return { outcome: response.code, retry: false, uncertain: false, message: response.message ?? SETTLED_MESSAGE, reference: null };
  }

  return uncertain();
}
