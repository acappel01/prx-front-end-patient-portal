/**
 * Small display helpers shared by the read-only screens. No data decisions
 * here: the admin already sends the patient-facing words (`status_label`).
 */

/** "149.00" + "USD" -> "$149.00". An amount that is not a number is shown as sent. */
export function money(amount, currency = 'USD') {
  const value = Number(amount);

  if (amount === null || amount === undefined || amount === '' || Number.isNaN(value)) return null;

  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
  } catch {
    return String(amount);
  }
}

/** "on_hold" -> "On hold". For provider values that are already words. */
export function humanize(value) {
  if (typeof value !== 'string' || value === '') return null;

  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
