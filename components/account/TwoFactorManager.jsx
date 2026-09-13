'use client';

import { useRef, useState } from 'react';

/**
 * Set up, replace, get new recovery codes for, or turn off two-step verification.
 *
 * Every step goes through the portal proxy and needs something the patient types
 * — the password to start a first setup, a code for everything after; the admin
 * decides everything. Recovery codes arrive in exactly one response
 * and live only in this component's state — the screen says so before showing
 * them, and a reload loses them for good.
 */

async function call(path, body) {
  const response = await fetch(`/api/portal/patient/two-factor/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).catch(() => null);

  const payload = await response?.json().catch(() => null);

  if (response?.status === 401) {
    window.location.assign('/login');
  }

  return {
    ok: Boolean(response?.ok),
    status: response?.status ?? 0,
    data: payload?.data ?? null,
    message: payload?.errors ? Object.values(payload.errors).flat()[0] : (payload?.message ?? null),
  };
}

function groupSecret(secret) {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * One or two inputs and a submit. Top-level on purpose: defined inside the
 * manager it would be a new component on every render, and React would remount
 * it — clearing what the patient typed the moment an error appeared.
 */
function CodeForm({ label, submitLabel, onSubmit, onCancel, busy, error, allowRecovery = false, withPassword = false }) {
  return (
    <form
      className="prx-card prx-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit(form.get('code'), form.get('password'));
      }}
    >
      {withPassword ? (
        <div className="prx-field">
          <label htmlFor="tf-password">Password</label>
          <input id="tf-password" name="password" type="password" autoComplete="current-password" required />
        </div>
      ) : null}
      <div className="prx-field">
        <label htmlFor="tf-code">{label}</label>
        <input
          id="tf-code"
          name="code"
          type="text"
          inputMode={allowRecovery ? 'text' : 'numeric'}
          maxLength={allowRecovery ? 24 : 7}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
        />
      </div>
      {error ? (
        <p className="prx-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Checking…' : submitLabel}
      </button>
      {onCancel ? (
        <p className="prx-form__links">
          <button type="button" className="prx-link" onClick={onCancel}>
            Cancel
          </button>
        </p>
      ) : null}
    </form>
  );
}

export default function TwoFactorManager({ status }) {
  const [phase, setPhase] = useState('overview');
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const codesRef = useRef(null);

  const enabled = status.enabled;

  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const startSetup = (currentCode, password) => run(async () => {
    const result = await call('setup', currentCode ? { code: currentCode } : { password });
    if (!result.ok) return setError(result.message ?? 'We couldn’t start setup. Try again.');
    setSetup(result.data);
    setPhase('scan');
  });

  const confirm = (code) => run(async () => {
    const result = await call('confirm', { code });
    if (!result.ok) return setError(result.message ?? 'That code didn’t match.');
    setCodes(result.data.recovery_codes);
    setSetup(null);
    setPhase('codes');
  });

  const regenerate = (code) => run(async () => {
    const result = await call('recovery-codes', { code });
    if (!result.ok) return setError(result.message ?? 'That code didn’t work.');
    setCodes(result.data.recovery_codes);
    setPhase('codes');
  });

  const disable = (password, code) => run(async () => {
    const result = await call('disable', { password, code });
    if (!result.ok) return setError(result.message ?? 'Those details didn’t match.');
    window.location.assign('/record/security');
  });

  async function copyCodes() {
    const text = codes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard refused (permissions, old browser): select them instead.
      const range = document.createRange();
      range.selectNodeContents(codesRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }

  function downloadCodes() {
    const blob = new Blob([`Recovery codes — each works once.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'recovery-codes.txt';
    link.click();
    // Deferred: revoking in the same tick has cancelled the download in Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function cancel() {
    setPhase('overview');
    setSetup(null);
    setError(null);
  }

  const errorLine = error ? (
    <p className="prx-field__error" role="alert">
      {error}
    </p>
  ) : null;

  if (phase === 'codes' && codes) {
    return (
      <div className="prx-card prx-form">
        <h2>Save your recovery codes</h2>
        <p className="prx-muted">
          If you lose your phone, each of these lets you sign in once. This is the only time they are shown — store them
          somewhere safe, like a password manager.
        </p>
        <ol className="prx-codes" ref={codesRef}>
          {codes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ol>
        <p className="prx-timeout__actions">
          <button type="button" className="prx-timeout__secondary" onClick={copyCodes}>
            {copied ? 'Copied' : 'Copy all'}
          </button>
          <button type="button" className="prx-timeout__secondary" onClick={downloadCodes}>
            Download
          </button>
        </p>
        <label className="prx-check">
          <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> I have saved these codes
        </label>
        <button
          type="button"
          className="prx-task__cta prx-form__submit"
          disabled={!saved}
          onClick={() => window.location.assign('/record/security')}
        >
          Done
        </button>
      </div>
    );
  }

  if (phase === 'scan' && setup) {
    return (
      <>
        <div className="prx-card prx-form">
          <h2>1. Add this account to your authenticator app</h2>
          <p className="prx-muted">
            Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan this code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="prx-qr" src={setup.qr_code} alt="QR code to add this account to your authenticator app" width={200} height={200} />
          <details className="prx-manual-key">
            <summary>Can&rsquo;t scan it? Enter a key instead</summary>
            <p>
              <code>{groupSecret(setup.secret)}</code>
            </p>
          </details>
        </div>
        <h2>2. Enter the 6-digit code it shows</h2>
        <CodeForm label="Code from your app" submitLabel="Turn on" busy={busy} error={error} onSubmit={(code) => confirm(code)} onCancel={cancel} />
      </>
    );
  }

  if (phase === 'replace') {
    return (
      <CodeForm
        label="Current code, or a recovery code"
        submitLabel="Continue"
        allowRecovery
        busy={busy}
        error={error}
        onSubmit={(code) => startSetup(code)}
        onCancel={cancel}
      />
    );
  }

  if (phase === 'regenerate') {
    return (
      <CodeForm label="Code from your authenticator app" submitLabel="Get new codes" busy={busy} error={error} onSubmit={(code) => regenerate(code)} onCancel={cancel} />
    );
  }

  if (phase === 'disable') {
    return (
      <CodeForm
        label="Code from your app, or a recovery code"
        submitLabel="Turn off"
        allowRecovery
        withPassword
        busy={busy}
        error={error}
        onSubmit={(code, password) => disable(password, code)}
        onCancel={cancel}
      />
    );
  }

  if (!enabled) {
    if (!status.offered) {
      return <p className="prx-muted">Two-step verification isn&rsquo;t available for this account.</p>;
    }

    return (
      <form
        className="prx-card prx-form"
        onSubmit={(event) => {
          event.preventDefault();
          startSetup(null, new FormData(event.currentTarget).get('password'));
        }}
      >
        <p>
          Two-step verification adds a code from an app on your phone after your password, so nobody can get into your
          account with your password alone.
        </p>
        {/* The password first, so a session left open on someone else's device
            cannot put THEIR phone on this account and lock the owner out. */}
        <div className="prx-field">
          <label htmlFor="tf-setup-password">Your password</label>
          <input id="tf-setup-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {errorLine}
        <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
          {busy ? 'Starting…' : 'Set it up'}
        </button>
      </form>
    );
  }

  return (
    <div className="prx-card prx-form">
      <p>
        <strong>On.</strong> Signing in needs a code from your authenticator app.
      </p>
      <p className="prx-muted">
        {status.recovery_codes_remaining} of 8 recovery codes left.
        {status.recovery_codes_remaining <= 2 ? ' Get new ones soon.' : ''}
      </p>
      <ul className="prx-rows">
        <li className="prx-row">
          <button type="button" className="prx-link" onClick={() => setPhase('regenerate')}>
            Get new recovery codes
          </button>
        </li>
        <li className="prx-row">
          <button type="button" className="prx-link" onClick={() => setPhase('replace')}>
            Switch to a new phone or app
          </button>
        </li>
        {status.can_disable ? (
          <li className="prx-row">
            <button type="button" className="prx-link" onClick={() => setPhase('disable')}>
              Turn off two-step verification
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
