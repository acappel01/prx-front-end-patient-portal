import { adminFetch } from '@/lib/adminApi';

/**
 * "Your details" on Record — name, date of birth, contact and patient number as
 * the clinical provider holds them.
 *
 * Read live on every visit (`GET /patient/profile`); the admin keeps only the
 * provider's identifiers, never a copy of the demographics. If something here is
 * wrong, the provider's record is what needs correcting, so the screen points to
 * the care team rather than offering an edit that would change only our copy.
 *
 * Quiet on failure and for an account with no record yet.
 */
function formatDob(dob) {
  if (!dob) return null;

  // A date, not an instant: format without a timezone shift.
  const [year, month, day] = String(dob).slice(0, 10).split('-').map(Number);

  if (!year || !month || !day) return dob;

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function ProfileDetails() {
  const result = await adminFetch('/patient/profile').catch(() => null);

  if (!result?.ok || !result.data) return null;

  const profile = result.data;
  const name = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ');
  const rows = [
    ['Name', name || null],
    ['Date of birth', formatDob(profile.dob)],
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['Patient number', profile.patient_number],
  ].filter(([, value]) => value);

  if (rows.length === 0) return null;

  return (
    <section className="prx-security" aria-labelledby="prx-details-heading">
      <h2 id="prx-details-heading">Your details</h2>
      <dl className="prx-details">
        {rows.map(([label, value]) => (
          <div className="prx-row" key={label}>
            <dt className="prx-row__meta">{label}</dt>
            <dd className="prx-security__what">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="prx-security__note prx-muted">
        Something wrong? <a href="/talk">Message your care team</a> and they&rsquo;ll update your record.
      </p>
    </section>
  );
}
