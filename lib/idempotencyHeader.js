/**
 * The `Idempotency-Key` header, the one browser header the proxy passes on.
 *
 * The admin's clinical writes (vitals today) accept an optional key and, for
 * the same key, answer the first result again instead of writing a second row
 * (`App\Support\Idempotency\IdempotentReplay` in the admin). The form mints one
 * key per attempt; the proxy forwards it by name only, never the browser's
 * other headers, and only when it is a plain token, so nothing the browser
 * sends can smuggle a second header or a line break upstream.
 *
 * Pure, no Next imports, so `node --test` covers it.
 */

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

const SHAPE = /^[\x21-\x7E]{8,255}$/;

/** The key to forward, or null when there is none or it is not a plain token. */
export function idempotencyKeyFrom(headers) {
  const value = headers?.get?.(IDEMPOTENCY_HEADER) ?? null;

  return typeof value === 'string' && SHAPE.test(value) ? value : null;
}
