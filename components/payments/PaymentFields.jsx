'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { CARD_FORMS } from '@/components/payments/gateways';
import { portalCall } from '@/lib/portalClient';

/**
 * Card entry that never lets a card number reach our servers: the portal's
 * copy of the storefront's PaymentFields, which the membership join uses.
 *
 * THE WHOLE DESIGN IS THAT BOUNDARY. The card is typed into the gateway's own
 * fields (Collect.js, Stripe, Square) or, for Authorize.Net, handed straight
 * to Accept.js, and exchanged for an opaque token. Only the token, the brand,
 * the last four and the expiry leave this component. Nothing card-shaped may
 * be added to a request body, written to storage, or logged.
 *
 * WHICH GATEWAY comes from the admin every time (`configPath`, read through
 * the portal proxy), because merchant accounts rotate, and the account that
 * tokenises must be the account that stores the card: the context's
 * `merchant_account_id` travels back with the token. To pick an account
 * again, the parent remounts this component (`key`).
 *
 * The gateway SDKs load from the gateways' own hosts, which the portal's
 * Content-Security-Policy allows only on the payment routes
 * (lib/securityHeaders.js, PAYMENT_PATHS). The parent makes sure this
 * document was served under that policy (lib/paymentPage.js) before mounting.
 *
 * The parent calls `tokenize()` via a ref and receives either a payload or a
 * thrown error; it never reads card state.
 */
const PaymentFields = forwardRef(
  /** @param {{ configPath: string }} props @param {import('react').ForwardedRef<any>} ref */
  function PaymentFields({ configPath }, ref) {
  const [context, setContext] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const formRef = useRef(null);
  // Read once at mount: a new path must not swap the gateway under a card
  // the patient is typing.
  const path = useRef(configPath);

  useEffect(() => {
    let cancelled = false;

    portalCall(path.current, { onUnauthenticated: 'sign-in' }).then((result) => {
      if (cancelled || result.status === 401) return;

      if (!result.ok || !CARD_FORMS[result.data?.gateway_provider]) {
        setLoadError(result.message ?? 'Card payment isn’t available right now. Please try again later.');

        return;
      }

      setContext(result.data);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    /**
     * Exchange the typed card for an opaque token. Throws on any failure, so
     * a declined card can never be mistaken for a success. No PAN, no CVC.
     */
    async tokenize(options = {}) {
      if (!context || !formRef.current) {
        throw new Error('Payment is not ready yet. Please try again in a moment.');
      }

      const { token, card } = await formRef.current.tokenize(options);

      return {
        // The account that tokenised. The card must be stored on THIS one.
        merchant_account_id: context.merchant_account_id,
        gateway_provider: context.gateway_provider,
        token,
        card,
      };
    },
    isReady: () => Boolean(context),
  }));

  if (loadError) {
    return (
      <p className="prx-field__error" role="alert">
        {loadError}
      </p>
    );
  }

  if (!context) {
    return <p className="pay-note">Loading secure card entry…</p>;
  }

  const CardForm = CARD_FORMS[context.gateway_provider];

  return (
    <div className="pay-fields">
      <CardForm context={context} ref={formRef} />
      <p className="pay-note">Card details go straight to our payment provider and are never stored on this site.</p>
    </div>
  );
});

export default PaymentFields;
