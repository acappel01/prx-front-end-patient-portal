import { adminFetch } from '@/lib/adminApi';

/** Record's way into Security, with the current state. Quiet on failure. */
export default async function TwoFactorStatusLink() {
  const result = await adminFetch('/patient/two-factor').catch(() => null);
  const status = result?.ok ? result.data : null;

  if (!status || (!status.enabled && !status.offered)) return null;

  return (
    <ul className="prx-rows prx-security-link">
      <li className="prx-row">
        <a href="/record/security">Two-step verification</a>
        <span className="prx-row__meta">{status.enabled ? 'On' : 'Off'}</span>
      </li>
    </ul>
  );
}
