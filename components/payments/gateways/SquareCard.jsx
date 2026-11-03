"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import HostedField from "@/components/payments/gateways/HostedField";
import { hostedFieldStyle, loadScript } from "@/lib/payments/loadScript";
import { normalizeBrand } from "@/lib/payments/cardInput";

/**
 * Square: the Web Payments SDK card, attached to one HostedField box.
 *
 * The token is a card nonce (`cnon:…`) the server pays with. Square's card
 * form asks for the ZIP itself, so it is not passed in.
 */
const SquareCard = forwardRef(
  /** @param {{ context: Record<string, any> }} props @param {import("react").ForwardedRef<any>} ref */
  function SquareCard({ context }, ref) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const Square = await loadScript(context.sdk_url, "Square");
      if (cancelled || !mountRef.current) return;

      const payments = Square.payments(context.public_key, context.location_id);
      const style = hostedFieldStyle(mountRef.current);

      // Square rejects style values it does not support (fonts especially),
      // so a styled card that fails falls back to Square's own look rather
      // than to no card form at all.
      let card;
      try {
        card = await payments.card({
          style: {
            input: { color: style.color, fontSize: style.fontSize },
            "input::placeholder": { color: style.placeholder },
            ".input-container.is-error": { borderColor: style.error },
          },
        });
      } catch {
        card = await payments.card();
      }

      if (cancelled) {
        card.destroy();
        return;
      }

      await card.attach(mountRef.current);
      cardRef.current = card;
      setReady(true);
    })().catch(() => {
      // Surfaced at tokenise time, where the visitor is looking.
    });

    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [context.sdk_url, context.public_key, context.location_id]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!ready || !cardRef.current) {
        throw new Error("Payment is not ready yet. Please try again in a moment.");
      }

      const result = await cardRef.current.tokenize();

      if (result?.status !== "OK" || !result.token) {
        const message =
          result?.errors?.[0]?.message ?? "We couldn't verify that card. Please check the details and try again.";
        setError(message);
        throw new Error(message);
      }

      setError(null);
      const card = result.details?.card ?? {};

      return {
        token: result.token,
        card: {
          brand: normalizeBrand(card.brand),
          last_four: card.last4 ?? null,
          expiration_month: card.expMonth ?? null,
          expiration_year: card.expYear ?? null,
        },
      };
    },
  }));

  return <HostedField className="pay-hosted--square" error={error} id="square-card" label="Card" ref={mountRef} />;
});

export default SquareCard;
