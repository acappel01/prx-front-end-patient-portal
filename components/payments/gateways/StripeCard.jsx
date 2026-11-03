"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import HostedField from "@/components/payments/gateways/HostedField";
import { hostedFieldStyle, loadScript } from "@/lib/payments/loadScript";
import { normalizeBrand } from "@/lib/payments/cardInput";

/**
 * Stripe: the Card Element from Stripe.js, mounted into one HostedField box.
 *
 * The token is a PaymentMethod id (`pm_…`), which the server confirms as a
 * PaymentIntent. The ZIP is hidden in the element and taken from the address
 * the visitor already typed on the checkout, so it is asked once and still
 * reaches Stripe for the postcode check.
 */
const StripeCard = forwardRef(
  /** @param {{ context: Record<string, any> }} props @param {import("react").ForwardedRef<any>} ref */
  function StripeCard({ context }, ref) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);
  const stripeRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadScript(context.sdk_url, "Stripe")
      .then((Stripe) => {
        if (cancelled || !mountRef.current) return;

        const style = hostedFieldStyle(mountRef.current);
        const stripe = Stripe(context.public_key);
        const card = stripe.elements().create("card", {
          hidePostalCode: true,
          style: {
            base: {
              color: style.color,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              "::placeholder": { color: style.placeholder },
            },
            invalid: { color: style.error, iconColor: style.error },
          },
        });

        card.on("ready", () => !cancelled && setReady(true));
        card.on("change", (event) => !cancelled && setError(event.error?.message ?? null));
        card.mount(mountRef.current);

        stripeRef.current = stripe;
        cardRef.current = card;
      })
      .catch(() => {
        // Surfaced at tokenise time, where the visitor is looking.
      });

    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
      stripeRef.current = null;
    };
  }, [context.sdk_url, context.public_key]);

  useImperativeHandle(ref, () => ({
    /** @param {{ billing?: { name?: string, email?: string, postal_code?: string } }} [options] */
    async tokenize({ billing } = {}) {
      if (!ready || !stripeRef.current || !cardRef.current) {
        throw new Error("Payment is not ready yet. Please try again in a moment.");
      }

      const { paymentMethod, error: failure } = await stripeRef.current.createPaymentMethod({
        type: "card",
        card: cardRef.current,
        billing_details: {
          name: billing?.name || undefined,
          email: billing?.email || undefined,
          address: billing?.postal_code ? { postal_code: billing.postal_code, country: "US" } : undefined,
        },
      });

      if (failure || !paymentMethod?.id) {
        // Stripe's card messages are written for shoppers.
        const message = failure?.message ?? "We couldn't verify that card. Please check the details and try again.";
        setError(message);
        throw new Error(message);
      }

      return {
        token: paymentMethod.id,
        card: {
          brand: normalizeBrand(paymentMethod.card?.brand),
          last_four: paymentMethod.card?.last4 ?? null,
          expiration_month: paymentMethod.card?.exp_month ?? null,
          expiration_year: paymentMethod.card?.exp_year ?? null,
        },
      };
    },
  }));

  return <HostedField error={error} id="stripe-card" label="Card" ref={mountRef} />;
});

export default StripeCard;
