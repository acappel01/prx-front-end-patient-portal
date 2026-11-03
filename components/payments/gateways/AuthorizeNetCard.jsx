"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { loadScript, wait } from "@/lib/payments/loadScript";
import {
  cardBrand,
  cardDigits,
  expiryParts,
  formatCardNumber,
  formatCvc,
  formatExpiry,
  isPlausibleCardNumber,
  isPlausibleCvc,
  lastFour,
} from "@/lib/payments/cardInput";

/**
 * Authorize.Net: our own inputs, tokenised by Accept.js.
 *
 * Accept.js has no hosted fields, so the number is typed into inputs on this
 * page and handed straight to `Accept.dispatchData`. It never leaves this
 * component except to Accept.js. (Accept.js stays, rather than Authorize.Net's
 * hosted form, because its opaque data is what lets the customer profile and
 * the transaction reach Prescribe-RX.)
 *
 * Because the card is in our DOM, the page is held to what can read it: the
 * one portal route that renders this form (/record/membership) runs no
 * third-party script and is served under a Content-Security-Policy that lets
 * only this app's bundles, Next's nonced scripts and the gateways' hosts run
 * (lib/securityHeaders.js, PAYMENT_PATHS).
 *
 * `Accept.dispatchData` is callback-based and reports failure through a
 * `messages.resultCode` of `Error` rather than by throwing, so the promise
 * wrapper has to inspect the result — a naive `resolve(response)` would treat
 * a declined card as a success.
 */
const NOT_LOADED = "E_WC_03";

/**
 * Dispatch, retrying the one error that means "ask again in a moment".
 *
 * Accept.js pulls further scripts of its own AFTER its `onload` fires, and
 * dispatching in that window returns `E_WC_03: Accept.js is not loaded
 * correctly` — which reads like a misconfiguration and is really a race.
 * Observed against the live sandbox: the identical call fails immediately
 * after load and succeeds a moment later with the same credentials.
 *
 * Retrying on that specific code beats a fixed delay before dispatch: a delay
 * is a guess that slows down every correct submission, and would still lose
 * whenever the network is slower than the guess.
 */
async function dispatchWithRetry(sdk, auth, card, attempts = 4) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await dispatch(sdk, auth, card);
    } catch (error) {
      if (error.code !== NOT_LOADED || attempt >= attempts - 1) {
        throw error;
      }

      await wait(400 * (attempt + 1));
    }
  }
}

function dispatch(sdk, { apiLoginID, clientKey }, card) {
  return new Promise((resolve, reject) => {
    sdk.dispatchData(
      {
        authData: { clientKey, apiLoginID },
        cardData: {
          cardNumber: card.number,
          month: card.month,
          year: card.year,
          cardCode: card.cvc,
        },
      },
      (response) => {
        if (response?.messages?.resultCode === "Error") {
          const first = response.messages.message?.[0];

          // Their text is written for developers ("E_WC_05: ..."), so a card
          // problem gets a human sentence and everything else gets a generic
          // one. The raw code is not surfaced to the visitor — it would mean
          // nothing to them and can hint at gateway internals — but it IS
          // carried on the error so the retry above can act on it.
          const failure = /** @type {Error & { code?: string }} */ (new Error(
            cardMessageFor(first?.code) ?? "We couldn't verify that card. Please check the details and try again.",
          ));
          failure.code = first?.code;

          // The CODE is safe to log and is the only way to tell a declined
          // card from a misconfigured gateway from the load race. Card data
          // is never logged — this is the gateway's own error identifier.
          console.warn("[payment] gateway rejected tokenisation:", first?.code, first?.text);
          reject(failure);
          return;
        }

        const opaque = response?.opaqueData;

        if (!opaque?.dataDescriptor || !opaque?.dataValue) {
          reject(new Error("The payment library returned no token. Please try again."));
          return;
        }

        resolve({ data_descriptor: opaque.dataDescriptor, data_value: opaque.dataValue });
      },
    );
  });
}

/** The handful of Accept.js codes that mean "the visitor can fix this". */
function cardMessageFor(code) {
  return {
    E_WC_05: "Please check the card number.",
    E_WC_06: "Please check the expiry month.",
    E_WC_07: "Please check the expiry year.",
    E_WC_08: "That card has expired.",
    E_WC_15: "Please check the security code.",
    E_WC_17: "Please check the name on the card.",
  }[code] ?? null;
}

/**
 * A card input. NO `name` ATTRIBUTE, deliberately (scripts/payment-csp.test.mjs
 * in the storefront, which this file mirrors): an unnamed input is left out of every form
 * submission, FormData and serialisation of the surrounding checkout form, and
 * gives browser extensions and form-scraping scripts nothing to match on. The
 * value lives only in this component's state until Accept.js takes it.
 */
function Field({ id, label, error, ...props }) {
  return (
    <div className="prx-field">
      <label htmlFor={id}>{label}</label>
      <input aria-invalid={error ? "true" : undefined} autoComplete="off" id={id} {...props} />
      {error ? <p className="prx-field__error">{error}</p> : null}
    </div>
  );
}

const AuthorizeNetCard = forwardRef(
  /** @param {{ context: Record<string, any> }} props @param {import("react").ForwardedRef<any>} ref */
  function AuthorizeNetCard({ context }, ref) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState(/** @type {Record<string, string>} */ ({}));

  const brand = cardBrand(number);
  const sdkUrl = context.sdk_url ?? context.accept_js_url;

  // Warm the SDK as soon as the gateway is known, so the first submit is not
  // also the first network round trip for a third-party script.
  useEffect(() => {
    loadScript(sdkUrl, "Accept").catch(() => {
      // Surfaced at tokenise time instead — a preload failure alone should
      // not blank a form the visitor may never submit.
    });
  }, [sdkUrl]);

  const validate = () => {
    /** @type {Record<string, string>} */
    const next = {};

    if (!isPlausibleCardNumber(number)) next.card_number = "Enter the full card number.";
    if (!expiryParts(expiry)) next.card_expiry = "Enter a valid future expiry date.";
    if (!isPlausibleCvc(cvc, brand)) next.card_cvc = "Enter the security code.";

    setErrors(next);

    return Object.keys(next).length === 0;
  };

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (!validate()) {
        throw new Error("Please check the card details.");
      }

      const parts = expiryParts(expiry);
      const sdk = await loadScript(sdkUrl, "Accept");

      const token = await dispatchWithRetry(
        sdk,
        { apiLoginID: context.api_login_id, clientKey: context.public_key },
        { number: cardDigits(number), month: parts.month, year: parts.year, cvc },
      );

      return {
        token,
        card: {
          brand,
          last_four: lastFour(number),
          expiration_month: Number(parts.month),
          expiration_year: Number(parts.year),
        },
      };
    },
  }));

  return (
    <>
      <div>
        <Field
          error={errors.card_number}
          id="card_number"
          inputMode="numeric"
          label={brand ? `Card number (${brand})` : "Card number"}
          onChange={(event) => setNumber(formatCardNumber(event.target.value))}
          value={number}
        />
      </div>
      <div className="prx-field-pair">
        <Field
          error={errors.card_expiry}
          id="card_expiry"
          inputMode="numeric"
          label="Expiry (mm/yy)"
          maxLength={5}
          onChange={(event) => setExpiry(formatExpiry(event.target.value))}
          value={expiry}
        />
        <Field
          error={errors.card_cvc}
          id="card_cvc"
          inputMode="numeric"
          label="Security code"
          onChange={(event) => setCvc(formatCvc(event.target.value, brand))}
          value={cvc}
        />
      </div>
    </>
  );
});

export default AuthorizeNetCard;
