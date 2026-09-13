'use client';

import { useState } from 'react';

import LocalTime from '@/components/ui/LocalTime';

/**
 * The browsers allowed to skip the code on this account, with a way to stop
 * trusting one or all. Removing trust here does not sign anyone out — it means
 * that browser will be asked for a code next time.
 */
export default function TrustedDevicesList({ devices: initial }) {
  const [devices, setDevices] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function revoke(path, remaining) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/portal/patient/trusted-devices/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => null);

    setBusy(false);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    if (!response?.ok) {
      setError('We couldn’t do that. Please try again.');

      return;
    }

    setDevices(remaining);
  }

  return (
    <section className="prx-security" aria-labelledby="prx-trusted-heading">
      <h2 id="prx-trusted-heading">Trusted browsers</h2>
      <p className="prx-lede prx-muted">These can skip the code when you sign in — never the password.</p>

      {devices.length === 0 ? (
        <p className="prx-muted">None. You&rsquo;ll be asked for a code every time you sign in.</p>
      ) : (
        <>
          <ul className="prx-rows">
            {devices.map((device) => (
              <li className="prx-row" key={device.id}>
                <span className="prx-security__what">
                  {device.label ?? 'Unknown browser'}
                  <br />
                  <span className="prx-row__meta">
                    Last used <LocalTime value={device.last_used_at ?? device.created_at} />
                    {device.last_used_ip ? ` · ${device.last_used_ip}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="prx-link"
                  disabled={busy}
                  onClick={() => revoke(`${device.id}/revoke`, devices.filter((d) => d.id !== device.id))}
                >
                  Remove<span className="prx-visually-hidden"> {device.label ?? 'this browser'}</span>
                </button>
              </li>
            ))}
          </ul>
          {devices.length > 1 ? (
            <p className="prx-form__links">
              <button type="button" className="prx-link" disabled={busy} onClick={() => revoke('revoke-all', [])}>
                Remove all
              </button>
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
