"use client";

import { forwardRef } from "react";

/**
 * A box the gateway mounts its own card input into (Collect.js, Stripe,
 * Square). The input lives in the gateway's iframe, so the label sits above
 * it rather than floating inside, and the box takes the page's input border
 * and radius from `.pay-hosted`.
 */
const HostedField = forwardRef(
  /** @param {{ id: string, label: string, error?: string | null, className?: string }} props @param {import("react").ForwardedRef<any>} ref */
  function HostedField({ id, label, error, className = "" }, ref) {
  return (
    <div className="pay-hostedField">
      <label className="pay-hostedLabel" htmlFor={id}>
        {label}
      </label>
      <div
        aria-invalid={error ? "true" : undefined}
        className={`pay-hosted ${className}`.trim()}
        id={id}
        ref={ref}
      />
      {error ? <p className="prx-field__error">{error}</p> : null}
    </div>
  );
});

export default HostedField;
