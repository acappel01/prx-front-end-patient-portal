import TrustedDevicesList from '@/components/account/TrustedDevicesList';
import TwoFactorManager from '@/components/account/TwoFactorManager';
import { adminFetch } from '@/lib/adminApi';

export const dynamic = 'force-dynamic';

/**
 * Record → Security: two-step verification.
 *
 * The status is read server-side; everything that changes it happens in
 * TwoFactorManager through the proxy, because each step needs a code the patient
 * types. `?required=1` is where a session confined by the `required` policy is
 * sent — it is reachable because the admin exempts these routes.
 */
export default async function SecurityPage({ searchParams }) {
  const required = (await searchParams)?.required === '1';
  const { ok, status, data } = await adminFetch('/patient/two-factor').catch(() => ({ ok: false, status: 0 }));

  if (status === 401) {
    return (
      <>
        <h1>Security</h1>
        <p className="prx-muted">
          Your session expired. <a href="/login">Sign in again</a>.
        </p>
      </>
    );
  }

  if (!ok || !data) {
    return (
      <>
        <h1>Security</h1>
        <p className="prx-muted">We can&rsquo;t load this right now. Please try again in a moment.</p>
      </>
    );
  }

  return (
    <>
      {data.setup_required || required ? null : (
        <p className="prx-back">
          <a href="/record">← Your record</a>
        </p>
      )}
      <h1>Two-step verification</h1>
      {data.setup_required ? (
        <p className="prx-notice" role="status">
          To keep your health information safe, set up two-step verification before you continue.
        </p>
      ) : null}
      <TwoFactorManager status={data} />
      {data.enabled ? <TrustedDevices /> : null}
    </>
  );
}

/** Only for an account with two-step on — without it there is nothing to skip. Quiet on failure. */
async function TrustedDevices() {
  const result = await adminFetch('/patient/trusted-devices').catch(() => null);

  if (!result?.ok || !Array.isArray(result.data)) return null;

  return <TrustedDevicesList devices={result.data} />;
}
