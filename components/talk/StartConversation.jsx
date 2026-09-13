'use client';

import { useState } from 'react';

import LocalTime from '@/components/ui/LocalTime';

/** Choose a visit, open its conversation, go there. */
export default function StartConversation({ encounters }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function open(encounterId) {
    if (busy) return;
    setBusy(encounterId);
    setError(null);

    const response = await fetch(`/api/portal/patient/encounters/${encounterId}/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    if (response?.ok && payload?.data?.conversation_id) {
      window.location.assign(`/talk/${payload.data.conversation_id}`);

      return;
    }

    setBusy(null);
    setError(payload?.message ?? 'We couldn’t open that conversation. Please try again.');
  }

  return (
    <>
      <p className="prx-lede prx-muted">Which visit is your message about?</p>
      <ul className="prx-rows">
        {encounters.map((encounter) => (
          <li className="prx-row" key={encounter.id}>
            <span className="prx-security__what">
              {encounter.reason_for_visit ?? encounter.encounter_number ?? 'Visit'}
              {encounter.scheduled_at || encounter.completed_at ? (
                <>
                  <br />
                  <span className="prx-row__meta">
                    <LocalTime value={encounter.scheduled_at ?? encounter.completed_at} />
                  </span>
                </>
              ) : null}
            </span>
            <button type="button" className="prx-link" disabled={busy !== null} onClick={() => open(encounter.id)}>
              {busy === encounter.id ? 'Opening…' : 'Message'}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
