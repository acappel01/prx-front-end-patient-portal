'use client';

import { useState } from 'react';

import Reference from '@/components/ui/Reference';

/**
 * Goal weight (80–500 lbs, the provider's own bounds) and an optional target
 * date. The provider keeps an existing value when a new one is left out, so a
 * goal can be changed here but not cleared — the form says only what it can do.
 */
export default function GoalForm({ current }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const [reference, setReference] = useState(null);

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const weight = String(form.get('goal_weight') ?? '').trim();
    const date = String(form.get('goal_date') ?? '').trim();

    setBusy(true);
    setErrors({});
    setReference(null);

    const response = await fetch('/api/portal/patient/vitals/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_weight: weight === '' ? null : Number(weight), ...(date ? { goal_date: date } : {}) }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setBusy(false);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    if (response?.ok) {
      setSaved(payload?.data ?? null);

      return;
    }

    if (response?.status === 422) {
      const upstream = payload?.errors ?? {};
      const mapped = {};

      for (const [name, messages] of Object.entries(upstream)) {
        mapped[['goal_weight', 'goal_date'].includes(name) ? name : 'form'] = Array.isArray(messages) ? messages[0] : String(messages);
      }

      setErrors(Object.keys(mapped).length > 0 ? mapped : { form: payload?.message ?? 'Please check the values.' });

      return;
    }

    // Setting a goal is safe to repeat: it replaces the value, never adds one.
    setReference(response && response.status >= 500 ? (payload?.request_id ?? null) : null);
    setErrors({ form: 'We couldn’t save your goal. Please try again.' });
  }

  if (saved) {
    return (
      <div className="prx-card" role="status">
        <h2>Goal saved</h2>
        <p className="prx-muted">
          Your goal is {saved.goal_weight} lbs{saved.goal_date ? ` by ${new Date(`${saved.goal_date}T12:00:00`).toLocaleDateString()}` : ''}. Your progress on Home is now measured against it.
        </p>
        <p>
          <a className="prx-task__cta" href="/">
            Back to Home
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="prx-card prx-form" onSubmit={onSubmit} noValidate>
      <div className="prx-field">
        <label htmlFor="goal_weight">
          Goal weight <span className="prx-muted">(lbs)</span>
        </label>
        <input
          id="goal_weight"
          name="goal_weight"
          type="number"
          inputMode="decimal"
          min={80}
          max={500}
          step="0.1"
          defaultValue={current?.goal_weight ?? ''}
          required
          aria-describedby={errors.goal_weight ? 'goal_weight-error' : undefined}
        />
        {errors.goal_weight ? <p id="goal_weight-error" className="prx-field__error" role="alert">{errors.goal_weight}</p> : null}
      </div>

      <div className="prx-field">
        <label htmlFor="goal_date">
          Target date <span className="prx-muted">(optional)</span>
        </label>
        {current?.goal_date ? (
          <p id="goal_date-hint" className="prx-muted prx-field__hint">Leaving this blank keeps your current target date.</p>
        ) : null}
        <input
          id="goal_date"
          name="goal_date"
          type="date"
          min={tomorrow}
          defaultValue={current?.goal_date ?? ''}
          aria-describedby={[current?.goal_date ? 'goal_date-hint' : null, errors.goal_date ? 'goal_date-error' : null].filter(Boolean).join(' ') || undefined}
        />
        {errors.goal_date ? <p id="goal_date-error" className="prx-field__error" role="alert">{errors.goal_date}</p> : null}
      </div>

      {errors.form ? <p className="prx-field__error" role="alert">{errors.form}</p> : null}
      <Reference id={reference} />

      <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
        {busy ? 'Saving…' : current?.goal_weight ? 'Update goal' : 'Save goal'}
      </button>
    </form>
  );
}
