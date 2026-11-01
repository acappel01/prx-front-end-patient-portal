'use client';

import { useState } from 'react';

import LocalTime from '@/components/ui/LocalTime';
import { portalCall } from '@/lib/portalClient';

/** Choose a visit, open its conversation, go there. */
export default function StartConversation({ encounters }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  async function open(encounterId) {
    if (busy) return;
    setBusy(encounterId);
    setError(null);

    const response = await portalCall(`/patient/encounters/${encounterId}/conversation`, { method: 'POST', body: {} });

    // Signing in again (portalCall has navigated away).
    if (response.status === 401) return;

    if (response.ok && response.data?.conversation_id) {
      window.location.assign(`/talk/${response.data.conversation_id}`);

      return;
    }

    setBusy(null);
    setError(response.message ?? 'We couldn’t open that conversation. Please try again.');
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
