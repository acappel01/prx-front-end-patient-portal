"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import HostedField from "@/components/payments/gateways/HostedField";
import { hostedFieldStyle, loadScript } from "@/lib/payments/loadScript";
import { normalizeBrand } from "@/lib/payments/cardInput";

/**
 * NMI: Collect.js inline fields.
 *
 * Each field is NMI's own iframe mounted into a HostedField box, so the card
 * number is typed on NMI's page, not ours. `startPaymentRequest()` asks
 * Collect.js for a token, and the answer comes back through the `callback`
 * given to `configure()`, so tokenize() parks a promise until it arrives.
 *
 * Collect.js is a page-wide singleton: one configured form at a time.
 */
const FIELDS = {
  ccnumber: { id: "nmi-ccnumber", label: "Card number", placeholder: "Card number" },
  ccexp: { id: "nmi-ccexp", label: "Expiry", placeholder: "MM / YY" },
  cvv: { id: "nmi-cvv", label: "Security code", placeholder: "CVC" },
};

const FIELD_ERRORS = {
  ccnumber: "Please check the card number.",
  ccexp: "Please check the expiry date.",
  cvv: "Please check the security code.",
};

// Long enough for a slow network, short enough that a stuck request does not
// leave the visitor watching a spinner.
const TIMEOUT_MS = 15000;

const NmiCard = forwardRef(
  /** @param {{ context: Record<string, any> }} props @param {import("react").ForwardedRef<any>} ref */
  function NmiCard({ context }, ref) {
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const pending = useRef(null);
  const styleRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadScript(context.sdk_url, "CollectJS", { "data-tokenization-key": context.public_key })
      .then((collect) => {
        if (cancelled) return;

        const style = hostedFieldStyle(styleRef.current);

        collect.configure({
          variant: "inline",
          // Collect.js binds a click handler to this selector. Point it at
          // nothing so it never hijacks a button; submit calls
          // startPaymentRequest() itself.
          paymentSelector: "#nmi-collect-unused",
          fields: Object.fromEntries(
            Object.entries(FIELDS).map(([name, field]) => [
              name,
              { selector: `#${field.id}`, placeholder: field.placeholder, ...(name === "cvv" ? { display: "show" } : {}) },
            ]),
          ),
          customCss: {
            color: style.color,
            "font-family": style.fontFamily,
            "font-size": style.fontSize,
            "background-color": "transparent",
            border: "none",
            height: "48px",
            padding: "0 12px",
          },
          invalidCss: { color: style.error },
          placeholderCss: { color: style.placeholder },
          timeoutDuration: TIMEOUT_MS,
          fieldsAvailableCallback: () => {
            if (!cancelled) setReady(true);
          },
          validationCallback: (field, valid, message) => {
            if (cancelled) return;

            setErrors((current) => ({ ...current, [field]: valid ? null : FIELD_ERRORS[field] ?? message }));

            // A field that fails while a token is being requested means no
            // token is coming: settle now instead of at the timeout.
            if (!valid && pending.current) {
              pending.current.reject(new Error("Please check the card details."));
              pending.current = null;
            }
          },
          timeoutCallback: () => {
            pending.current?.reject(new Error("The payment service did not respond. Please try again."));
            pending.current = null;
          },
          callback: (response) => {
            pending.current?.resolve(response);
            pending.current = null;
          },
        });
      })
      .catch(() => {
        // Surfaced at tokenise time, where the visitor is looking.
      });

    return () => {
      cancelled = true;
      pending.current = null;
    };
  }, [context.sdk_url, context.public_key]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      const collect = typeof window !== "undefined" ? /** @type {any} */ (window).CollectJS : null;

      if (!ready || !collect) {
        throw new Error("Payment is not ready yet. Please try again in a moment.");
      }

      const response = await new Promise((resolve, reject) => {
        pending.current = { resolve, reject };
        collect.startPaymentRequest();
      });

      if (!response?.token) {
        throw new Error("The payment service returned no token. Please try again.");
      }

      // `exp` is MMYY; `number` is masked ("411111******1111").
      const exp = String(response.card?.exp ?? "");

      return {
        token: response.token,
        card: {
          brand: normalizeBrand(response.card?.type),
          last_four: String(response.card?.number ?? "").slice(-4) || null,
          expiration_month: exp.length === 4 ? Number(exp.slice(0, 2)) : null,
          expiration_year: exp.length === 4 ? 2000 + Number(exp.slice(2)) : null,
        },
      };
    },
  }));

  return (
    <div ref={styleRef} className="pay-hostedGroup">
      <div>
        <HostedField error={errors.ccnumber} id={FIELDS.ccnumber.id} label={FIELDS.ccnumber.label} />
      </div>
      <div className="prx-field-pair">
        <HostedField error={errors.ccexp} id={FIELDS.ccexp.id} label={FIELDS.ccexp.label} />
        <HostedField error={errors.cvv} id={FIELDS.cvv.id} label={FIELDS.cvv.label} />
      </div>
    </div>
  );
});

export default NmiCard;
