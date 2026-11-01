/**
 * Where a session confined by the install's `required` two-step policy is sent:
 * the admin answers every other screen with `403 {code: two_factor_setup_required}`
 * and exempts this one. The single copy of that path, used by the server-side
 * guard (lib/screenGuards.js), the browser client (lib/portalClient.js) and
 * sign-in (below).
 */
export const TWO_FACTOR_SETUP_PATH = '/record/security?required=1';

/** Whether an admin answer is the `required` policy refusing this screen. */
export function needsTwoFactorSetup(result) {
  return result?.status === 403 && result?.code === 'two_factor_setup_required';
}

/**
 * Where a new session should land: two-step setup when the install requires it
 * and the account lacks it (the admin would answer every other screen with a
 * 403), otherwise Home.
 *
 * @param {import('@/lib/models').Patient | null | undefined} patient the admin's PatientResource
 * @returns {string}
 */
export function landingFor(patient) {
  return patient?.two_factor?.setup_required ? TWO_FACTOR_SETUP_PATH : '/';
}
