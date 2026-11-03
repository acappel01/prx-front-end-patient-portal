/**
 * Formatting for card fields.
 *
 * DELIBERATELY SEPARATE FROM `lib/inputMasks.js`, which exists to turn what a
 * person typed into something we POST. Nothing here is ever posted. A card
 * number, CVC and expiry go straight to the gateway's own SDK in the browser
 * and are exchanged for an opaque token; our servers never see them, and no
 * value produced by this file may end up in a request body, in component state
 * that gets serialised, or in a log.
 *
 * Keeping the two files apart is the point: the moment card helpers sit beside
 * lead-field helpers, someone reasonably assumes both are safe to send.
 */

function digits(value, max) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, max);
}

/**
 * Card brand from the leading digits, for display and for the vaulted-card
 * payload the provider expects (`card_brand`).
 *
 * Prefix ranges only — enough to label the field and name the brand. This is
 * not validation: the gateway is the authority on whether a number is real,
 * and guessing here would only produce a second opinion to disagree with.
 */
export function cardBrand(value) {
  const d = digits(value, 19);

  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^6(011|5|4[4-9])/.test(d)) return "Discover";

  return null;
}

/** Amex is 15 digits in 4-6-5; everything else here is 16 in groups of four. */
export function formatCardNumber(value) {
  const brand = cardBrand(value);
  const d = digits(value, brand === "Amex" ? 15 : 16);

  if (brand === "Amex") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(" ");
  }

  return (d.match(/.{1,4}/g) ?? []).join(" ");
}

export function cardDigits(value) {
  return digits(value, 19);
}

export function lastFour(value) {
  return digits(value, 19).slice(-4);
}

/**
 * A length check, not a validity check — the gateway decides that. This only
 * stops us dispatching an obviously incomplete number and burning a round trip
 * to show an error we could have shown instantly.
 */
export function isPlausibleCardNumber(value) {
  const length = digits(value, 19).length;

  return cardBrand(value) === "Amex" ? length === 15 : length >= 16;
}

/** Progressive expiry mask: 1227 -> 12/27. */
export function formatExpiry(value) {
  const d = digits(value, 4);

  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

/**
 * Expiry as the gateway wants it: a 2-digit month and a 4-digit year.
 *
 * Returns null on anything not a real, unexpired month — including a past
 * date, which the gateway would reject anyway but which is worth catching
 * before the card number leaves the field.
 */
export function expiryParts(value) {
  const d = digits(value, 4);

  if (d.length !== 4) {
    return null;
  }

  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));

  if (month < 1 || month > 12) {
    return null;
  }

  const now = new Date();
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));

  if (lastDayOfMonth < now) {
    return null;
  }

  return { month: String(month).padStart(2, "0"), year: String(year) };
}

/** Amex prints a 4-digit code; everyone else uses 3. */
export function formatCvc(value, brand) {
  return digits(value, brand === "Amex" ? 4 : 3);
}

export function isPlausibleCvc(value, brand) {
  return digits(value, 4).length === (brand === "Amex" ? 4 : 3);
}

/**
 * A hosted card form (Collect.js, Stripe, Square) reports the brand in its own
 * spelling: "visa", "VISA", "american_express", "AMERICAN_EXPRESS". Every
 * gateway's result is named the way `cardBrand()` names it, so the order and
 * the saved card read the same whichever gateway took the card.
 */
export function normalizeBrand(raw) {
  const key = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  return (
    {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "Amex",
      americanexpress: "Amex",
      discover: "Discover",
      diners: "Diners Club",
      dinersclub: "Diners Club",
      jcb: "JCB",
      unionpay: "UnionPay",
      chinaunionpay: "UnionPay",
    }[key] ?? (raw ? String(raw) : null)
  );
}
