'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Log a reading.
 *
 * ── The field names are the REQUEST names, not the response names ──────────
 *
 * The provider's vitals endpoint is asymmetric: it accepts `weight_lbs` /
 * `blood_pressure_systolic` and returns `weight` / `systolic_bp`. Posting the
 * names the Health screen reads back would be accepted, validate clean, and
 * store nothing — the whole body would fall out of the provider's `validate()`
 * and the row would be written empty. Verified against the handler and against
 * the live payload; do not "tidy" these to match the list.
 *
 * ── Why there is no "try again" button ─────────────────────────────────────
 *
 * P0-7: `POST /me/patient/vitals` inserts the row and THEN crashes, on every
 * single call, ordering by a column that does not exist. The write succeeds
 * while the API reports failure. So the natural response to an error — press
 * it again — writes a second reading, and the duplicate lands in the trend
 * this whole screen exists to draw. Self-reported weight is the main reason a
 * patient opens a portal between visits, so that is the one dataset we can
 * least afford to corrupt.
 *
 * We can only refuse to invite the retry, which means telling the truth: we do
 * not know whether it saved, and the list does. Anything that guessed for them
 * would be a guess printed on a clinical screen.
 *
 * The distinction that makes this survivable is the STATUS, and it only exists
 * because the admin stopped collapsing every upstream failure into one 500:
 *
 *   422 → the provider rejected the value. Nothing was written. Correcting it
 *         and resubmitting is right, and the form says so.
 *   any other failure → it may well have been written. No retry is offered.
 */

/**
 * The `min`/`max` here mirror the provider's own `validate()` rules, so an
 * out-of-range value is caught before it becomes a round trip. That is a
 * courtesy, never the gate — the provider re-validates and its 422 is handled
 * below.
 */
const WEIGHT = { name: 'weight_lbs', label: 'Weight', unit: 'lbs', min: 0, max: 1000, step: '0.1' };

// No `unit` on the pair: at half width every unit string wrapped the label onto
// a second line and the two inputs stopped reading as one measurement. The
// fieldset legend carries the units for both.
const SYSTOLIC = { name: 'blood_pressure_systolic', label: 'Top', min: 50, max: 300, step: '1' };
const DIASTOLIC = { name: 'blood_pressure_diastolic', label: 'Bottom', min: 30, max: 200, step: '1' };

const OTHERS = [
  { name: 'heart_rate', label: 'Heart rate', unit: 'bpm', min: 20, max: 250, step: '1' },
  // Integer, not `0.1`: `patient_vitals.blood_glucose` is an `integer`
  // column upstream while the request rule is only `numeric`, so 95.5 is
  // accepted, silently stored as 96, and read back as 96. Offering a
  // decimal keypad for a value the provider will round is a promise we
  // cannot keep. Weight is genuinely decimal upstream and keeps its step.
  { name: 'blood_glucose', label: 'Blood glucose', unit: 'mg/dL', min: 0, max: 1000, step: '1' },
];

const FIELDS = [WEIGHT, SYSTOLIC, DIASTOLIC, ...OTHERS];

// Everything behind the disclosure. An error against any of these has to open
// it, or the message renders where nobody can see it.
const EXTRAS = [SYSTOLIC.name, DIASTOLIC.name, ...OTHERS.map((f) => f.name), 'notes'];

const EMPTY = Object.fromEntries([...FIELDS.map((f) => [f.name, '']), ['notes', '']]);

function validate(values) {
  const errors = {};

  for (const field of FIELDS) {
    const raw = values[field.name].trim();

    if (raw === '') continue;

    const value = Number(raw);

    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      errors[field.name] = `Enter a number between ${field.min} and ${field.max}.`;
    }
  }

  if (values.notes.length > 500) errors.notes = 'Keep this under 500 characters.';

  // A single blood-pressure number is not a reading — it is half of one, and
  // the provider will store it as half of one rather than refuse it.
  const systolic = values.blood_pressure_systolic.trim();
  const diastolic = values.blood_pressure_diastolic.trim();

  if (systolic !== '' && diastolic === '')
    errors.blood_pressure_diastolic = 'Add the bottom number too.';
  if (diastolic !== '' && systolic === '')
    errors.blood_pressure_systolic = 'Add the top number too.';

  if (FIELDS.every((field) => values[field.name].trim() === '')) {
    errors.form = 'Add at least one measurement.';
  }

  return errors;
}

export default function VitalsForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // 'saved' | 'unconfirmed' | 'expired' — the three ends of this form. There
  // is deliberately no 'failed' that leaves you on a filled form with a live
  // submit button.
  const [outcome, setOutcome] = useState(null);
  const outcomeRef = useRef(null);

  // A ref, not the `busy` state, because state is not readable until React has
  // re-rendered and disabled the button. A double-tap — the most ordinary thing
  // a thumb does on a phone — could otherwise get two handlers in before that,
  // and on THIS endpoint two POSTs is two rows in the trend. The one duplicate
  // we can prevent outright, we prevent outright.
  const inFlight = useRef(false);
  const disclosureRef = useRef(null);

  // Declared here rather than beside the markup it drives: a `useEffect`
  // dependency array is evaluated at the call site, so a const declared
  // further down the component body is still in its temporal dead zone and
  // throws on first render. `next build` compiles that happily.
  const extrasNeedAttention = EXTRAS.some((name) => errors[name]);

  // Submitting replaces the whole form, so the focused button is removed from
  // the document and focus falls to <body> — a keyboard or screen-reader user
  // is left at the top of the page with no idea what happened. `role="alert"`
  // announces the text but does not move anyone to it, and on the unconfirmed
  // outcome the one thing they need is the link out.
  useEffect(() => {
    if (outcome) outcomeRef.current?.focus();
  }, [outcome]);

  // Written imperatively, and it has to be. `<details open={...}>` only writes
  // the DOM when the PROP changes, so once the patient has collapsed the
  // disclosure by hand the element and React disagree and a later render with
  // the same prop value is a no-op. The form then rejects a submission and
  // puts the reason inside a folded-away section: the button does nothing, no
  // message appears, and nothing is wrong that the patient can see.
  useEffect(() => {
    if (extrasNeedAttention && disclosureRef.current) disclosureRef.current.open = true;
  }, [extrasNeedAttention, errors]);

  function set(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();

    if (inFlight.current) return;

    const found = validate(values);

    setErrors(found);

    if (Object.keys(found).length > 0) return;

    inFlight.current = true;
    setBusy(true);

    const body = {};

    for (const field of FIELDS) {
      const raw = values[field.name].trim();

      if (raw !== '') body[field.name] = Number(raw);
    }

    if (values.notes.trim() !== '') body.notes = values.notes.trim();

    // `recorded_at` is deliberately not sent. The provider validates it and
    // then never passes it to the model, so a client that sends one is
    // silently ignored — and the row is timestamped `created_at` regardless.

    const response = await fetch('/api/portal/patient/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (response?.ok) {
      setOutcome('saved');
      setBusy(false);

      return;
    }

    if (response?.status === 401) {
      setOutcome('expired');
      setBusy(false);

      return;
    }

    if (response?.status === 422) {
      const payload = await response.json().catch(() => null);
      const upstream = payload?.errors ?? {};

      // Nothing was written, so this is the one failure a patient can fix and
      // resubmit. Keep the values, name the field, leave the button live.
      const mapped = {};
      const unplaceable = [];

      for (const [name, messages] of Object.entries(upstream)) {
        const text = Array.isArray(messages) ? messages[0] : String(messages);

        // A key we have no input for has nowhere to render, and an error that
        // renders nowhere is a form that rejects a submission and says why in
        // a place nobody can see. Send it to the banner instead of dropping
        // it — that is the whole silent-failure class this endpoint keeps
        // producing, one layer up.
        if (Object.hasOwn(EMPTY, name)) mapped[name] = text;
        else unplaceable.push(text);
      }

      if (unplaceable.length > 0 || Object.keys(mapped).length === 0) {
        mapped.form =
          unplaceable.length > 0
            ? unplaceable.join(' ')
            : payload?.message ?? 'Some of those values could not be accepted.';
      }

      setErrors(mapped);
      setBusy(false);
      // Released only here. A 422 wrote nothing, so resubmitting is the right
      // thing; every other ending is terminal and keeps the guard closed.
      inFlight.current = false;

      return;
    }

    // Everything else, including a network failure. The reading may be saved.
    setOutcome('unconfirmed');
    setBusy(false);
  }

  if (outcome === 'saved') {
    return (
      <div className="prx-card" role="status">
        <h2 ref={outcomeRef} tabIndex={-1}>
          Reading saved
        </h2>
        <p className="prx-muted">It is on your progress from today.</p>
        <p>
          <a className="prx-task__cta" href="/health">
            See my readings
          </a>
        </p>
      </div>
    );
  }

  if (outcome === 'expired') {
    return (
      <div className="prx-card" role="alert">
        <h2 ref={outcomeRef} tabIndex={-1}>
          Your session expired
        </h2>
        <p className="prx-muted">Sign in again and your reading will only take a moment to add.</p>
        <p>
          <a className="prx-task__cta" href="/login">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  if (outcome === 'unconfirmed') {
    return (
      // The copy this whole component is shaped around. It does not say "try
      // again", it does not offer a button that would resubmit, and it does
      // not claim the reading was lost — because it probably was not.
      <div className="prx-card" role="alert">
        <h2 ref={outcomeRef} tabIndex={-1}>
          We couldn&rsquo;t confirm that reading
        </h2>
        <p>
          It may still have been saved. Check your readings before adding it again — logging the
          same measurement twice would put a duplicate in your progress.
        </p>
        <p>
          <a className="prx-task__cta" href="/health">
            Check my readings
          </a>
        </p>
      </div>
    );
  }

  const field = (spec) => (
    <div className="prx-field" key={spec.name}>
      <label htmlFor={spec.name}>
        {spec.label} {spec.unit ? <span className="prx-muted">({spec.unit})</span> : null}
      </label>
      <input
        id={spec.name}
        name={spec.name}
        // `decimal`, not `numeric`: several of these take a fraction, and an
        // integer keypad on a phone has no decimal point on it.
        inputMode="decimal"
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={values[spec.name]}
        onChange={(event) => set(spec.name, event.target.value)}
        aria-invalid={errors[spec.name] ? 'true' : undefined}
        aria-describedby={errors[spec.name] ? `${spec.name}-error` : undefined}
      />
      {errors[spec.name] ? (
        <p className="prx-field__error" id={`${spec.name}-error`}>
          {errors[spec.name]}
        </p>
      ) : null}
    </div>
  );


  return (
    <>
      <p className="prx-muted prx-lede">
        Fill in whatever you measured. Anything you leave blank is simply not recorded.
      </p>
      <form className="prx-card prx-form" onSubmit={onSubmit} noValidate>
        {errors.form ? (
          <p className="prx-form__error" role="alert">
            {errors.form}
          </p>
        ) : null}

        {/* Weight is the reason this screen exists. Between visits it is the one
          measurement most patients take, so it is the one thing on the form
          until they ask for more — five empty boxes above the button turn a
          ten-second action into a scroll. */}
        {field(WEIGHT)}

        <details className="prx-disclosure" ref={disclosureRef}>
          <summary>
            <span className="prx-disclosure__marker" aria-hidden="true" />
            Add another measurement
          </summary>

          <fieldset className="prx-fieldset">
            <legend>Blood pressure (mmHg)</legend>
            {/* The one place a two-up row earns itself: 120 / 80 is how a cuff
              displays it and how every patient has been taught to read it.
              Splitting the pair into two full rows made it look like two
              unrelated readings. Each input still clears 44px comfortably. */}
            <div className="prx-field-pair">
              {field(SYSTOLIC)}
              {field(DIASTOLIC)}
            </div>
          </fieldset>

          {OTHERS.map(field)}

          <div className="prx-field">
            <label htmlFor="notes">
              Notes <span className="prx-muted">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={500}
              value={values.notes}
              onChange={(event) => set('notes', event.target.value)}
              aria-invalid={errors.notes ? 'true' : undefined}
              aria-describedby={errors.notes ? 'notes-error' : undefined}
            />
            {errors.notes ? (
              <p className="prx-field__error" id="notes-error">
                {errors.notes}
              </p>
            ) : null}
          </div>
        </details>

        <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save reading'}
        </button>
      </form>
    </>
  );
}
