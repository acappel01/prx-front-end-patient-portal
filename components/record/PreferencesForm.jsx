'use client';

import { useState } from 'react';

import { portalCall } from '@/lib/portalClient';

/**
 * Which messages the patient gets. Each switch saves on its own, so there is
 * no "Save" to forget; a failed save puts the switch back and says so.
 */
const CHANNELS = [
  ['email', 'Email'],
  ['sms', 'Text messages'],
  ['in_app', 'In the portal'],
];

export default function PreferencesForm({ initial }) {
  const [prefs, setPrefs] = useState({
    global_enabled: initial?.global_enabled ?? true,
    channels: { email: true, sms: true, in_app: true, ...(initial?.channels ?? {}) },
  });
  const [status, setStatus] = useState(null);

  async function save(change, next) {
    const previous = prefs;
    setPrefs(next);
    setStatus('Saving…');

    const response = await portalCall('/patient/communication-preferences', { method: 'POST', body: change });

    if (response.ok && response.data) {
      setPrefs({ global_enabled: response.data.global_enabled ?? next.global_enabled, channels: { ...next.channels, ...(response.data.channels ?? {}) } });
      setStatus('Saved.');

      return;
    }

    setPrefs(previous);
    setStatus('We couldn’t save that. Please try again.');
  }

  return (
    <form className="prx-card prx-form" onSubmit={(event) => event.preventDefault()}>
      <label className="prx-toggle">
        <input
          type="checkbox"
          checked={prefs.global_enabled}
          onChange={(event) => save({ global_enabled: event.target.checked }, { ...prefs, global_enabled: event.target.checked })}
        />
        <span>Send me updates about my care</span>
      </label>
      <fieldset className="prx-toggle-group" disabled={!prefs.global_enabled}>
        <legend className="prx-row__meta">How to reach me</legend>
        {CHANNELS.map(([key, label]) => (
          <label className="prx-toggle" key={key}>
            <input
              type="checkbox"
              checked={Boolean(prefs.channels[key])}
              onChange={(event) =>
                save({ channels: { [key]: event.target.checked } }, { ...prefs, channels: { ...prefs.channels, [key]: event.target.checked } })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="prx-muted">Messages about your account&rsquo;s security, like sign-in codes, are always sent.</p>
      {status ? (
        <p className="prx-row__meta" role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
