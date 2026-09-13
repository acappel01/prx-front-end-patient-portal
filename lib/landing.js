/**
 * Where a new session should land: two-step setup when the install requires it
 * and the account lacks it (the admin would answer every other screen with a
 * 403), otherwise Home. `patient` is the admin's PatientResource.
 */
export function landingFor(patient) {
  return patient?.two_factor?.setup_required ? '/record/security?required=1' : '/';
}
