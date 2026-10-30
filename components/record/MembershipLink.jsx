import { adminFetch } from '@/lib/adminApi';

/**
 * The Record row for Membership, only for a patient who has one. A failed read
 * hides the row rather than the page: the membership screen says why itself.
 */
export default async function MembershipLink() {
  const { ok, data } = await adminFetch('/patient/memberships');

  if (!ok || !Array.isArray(data) || data.length === 0) return null;

  return (
    <li className="prx-row">
      <a href="/record/membership">
        Membership <span aria-hidden="true">›</span>
      </a>
    </li>
  );
}
