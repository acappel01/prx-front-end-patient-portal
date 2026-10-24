'use client';

import { useEffect, useState } from 'react';

import Reference from '@/components/ui/Reference';
import { portalCall } from '@/lib/portalClient';

/**
 * A copy of the patient's record. Asking queues it with the clinical provider;
 * the page then checks every few seconds while it is open, and offers the
 * download when it is ready. The file streams through this app's own route,
 * because the provider's link needs a token the browser never holds.
 */
const POLL_MS = 5000;

export default function ExportPanel() {
  const [exportId, setExportId] = useState(null);
  const [state, setState] = useState({ status: 'idle' });

  useEffect(() => {
    if (!exportId || state.ready || state.status === 'failed') return undefined;

    const timer = setTimeout(async () => {
      const response = await portalCall(`/patient/export/${exportId}`);

      if (response.ok && response.data) {
        setState({ ...response.data, status: response.data.ready ? 'ready' : response.data.status });
      }
    }, POLL_MS);

    return () => clearTimeout(timer);
  }, [exportId, state]);

  async function request() {
    setState({ status: 'requesting' });
    const response = await portalCall('/patient/export', { method: 'POST' });

    if (response.ok && response.data?.export_id) {
      setExportId(response.data.export_id);
      setState({ status: response.data.status ?? 'queued' });

      return;
    }

    setState({
      status: 'error',
      message: response.status === 429 ? 'You have asked several times in the last hour. Please try again later.' : 'We couldn’t start that. Please try again.',
      reference: response.status >= 500 ? response.requestId : null,
    });
  }

  if (state.status === 'ready' && exportId) {
    return (
      <div className="prx-card" role="status">
        <h2>Your copy is ready</h2>
        <p className="prx-muted">It is a file you can keep or share with another provider. Store it somewhere private.</p>
        {state.expires_at ? (
          <p className="prx-row__meta">Available until {new Date(state.expires_at).toLocaleString()}.</p>
        ) : null}
        <p>
          <a className="prx-task__cta prx-task__cta--primary" href={`/api/export/${exportId}`}>
            Download my record
          </a>
        </p>
      </div>
    );
  }

  if (state.status === 'failed') {
    return (
      <div className="prx-card" role="status">
        <p className="prx-field__error">We couldn&rsquo;t prepare your copy. Please ask again, or message your care team.</p>
      </div>
    );
  }

  const working = exportId || state.status === 'requesting';

  return (
    <div className="prx-card">
      <p className="prx-muted">
        Everything we hold about your care: your details, visits, prescriptions, orders, readings and messages.
      </p>
      {working ? (
        <p role="status">Preparing your copy. You can leave this page; it will be here when you come back and ask again.</p>
      ) : (
        <button type="button" className="prx-task__cta prx-task__cta--primary" onClick={request}>
          Get a copy of my record
        </button>
      )}
      {state.status === 'error' ? (
        <p className="prx-field__error" role="alert">
          {state.message}
        </p>
      ) : null}
      <Reference id={state.reference ?? null} />
    </div>
  );
}
