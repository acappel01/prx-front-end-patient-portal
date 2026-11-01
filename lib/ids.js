/**
 * The one shape a path id may have before it is put into an admin path: the
 * admin's public uuids. Checked before interpolation everywhere (pages, route
 * handlers, the proxy allowlist), so `../` or an encoded slash never reaches
 * the admin. Deliberately loose on case and dash position (it matched the
 * admin's ids this way since the start); the admin resolves the id within the
 * session's own record either way.
 *
 * Plain module: server and browser code and `node --test` all import it.
 */

/** The id as a regex source, for composing a larger pattern (lib/portalProxy.js). */
export const UUID_PATTERN = '[0-9a-fA-F-]{36}';

/** The id, anchored. */
export const UUID = new RegExp(`^${UUID_PATTERN}$`);

/** Whether `value` is an id that may go into an admin path. */
export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}
