'use client';

import { useEffect, useState } from 'react';

import Reference from '@/components/ui/Reference';

/**
 * The form for what a held visit still needs, built from the provider's items.
 *
 * `file` items become photo inputs (the camera opens on a phone), `text` items
 * the licence fields, and `field` items the matching profile inputs. Anything
 * this screen has no input for is listed with a pointer to the care team.
 *
 * ── Retrying is safe here (unlike vitals) ────────────────────────────────────
 *
 * The provider replaces a document of the same kind and merges text, so sending
 * again cannot duplicate anything. A failure therefore says "try again" — the
 * opposite of the vitals form, on purpose. And "saved, more still needed" is a
 * success: what was sent is on file.
 */

const PHOTO_SLUGS = { id_front: 'id_front', id_upload: 'id_front', id_back: 'id_back', selfie_photo: 'selfie_photo', body_photo: 'body_photo' };

const FIELD_INPUTS = {
  drivers_license_number: [{ name: 'drivers_license_number', label: 'Licence number', autoComplete: 'off' }],
  drivers_license_state: [{ name: 'drivers_license_state', label: 'State of issue', autoComplete: 'off' }],
  drivers_license_or_identification_state_of_issue: [{ name: 'drivers_license_state', label: 'State of issue', autoComplete: 'off' }],
  patient_first_name: [{ name: 'first_name', label: 'First name', autoComplete: 'given-name' }],
  patient_last_name: [{ name: 'last_name', label: 'Last name', autoComplete: 'family-name' }],
  patient_date_of_birth: [{ name: 'date_of_birth', label: 'Date of birth', type: 'date', autoComplete: 'bday' }],
  patient_phone: [{ name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel' }],
  patient_gender: [{ name: 'gender', label: 'Sex', autoComplete: 'sex' }],
  patient_email: [{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }],
  patient_address: [
    { name: 'address_street1', label: 'Street address', autoComplete: 'address-line1' },
    { name: 'address_street2', label: 'Apartment, suite (optional)', autoComplete: 'address-line2', optional: true },
    { name: 'address_city', label: 'City', autoComplete: 'address-level2' },
    { name: 'address_state', label: 'State', autoComplete: 'address-level1' },
    { name: 'address_zip', label: 'ZIP code', autoComplete: 'postal-code', inputMode: 'numeric' },
  ],
  // The provider reports a single `vitals` item when no measurement is on file.
  vitals: [
    { name: 'weight', label: 'Weight (lbs)', inputMode: 'decimal' },
    { name: 'height_feet', label: 'Height (feet)', inputMode: 'numeric' },
    { name: 'height_inches', label: 'Height (inches)', inputMode: 'numeric' },
  ],
};

export default function ProvideInformationForm({ encounterId, items }) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [errors, setErrors] = useState({});
  const [reference, setReference] = useState(null);

  // The "Saved" banner rides on ?saved=1 for one render; drop it from the URL so
  // a later reload or back navigation doesn't show a stale notice.
  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.has('saved')) {
      url.searchParams.delete('saved');
      window.history.replaceState(null, '', url);
    }
  }, []);

  const photos = items.filter((item) => item.type === 'file' && PHOTO_SLUGS[item.slug]);
  const inputs = items.filter((item) => item.type !== 'file' && FIELD_INPUTS[item.slug]);
  const unhandled = items.filter((item) => !(item.type === 'file' && PHOTO_SLUGS[item.slug]) && !(item.type !== 'file' && FIELD_INPUTS[item.slug]));

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setErrors({});
    setOutcome(null);
    setReference(null);

    const form = new FormData(event.currentTarget);

    const response = await fetch(`/api/intake/${encounterId}`, { method: 'POST', body: form }).catch(() => null);
    const payload = await response?.json().catch(() => null);

    setBusy(false);

    if (response?.status === 401) {
      window.location.assign('/login');

      return;
    }

    if (response?.ok) {
      if (payload?.data?.released) {
        setOutcome('released');
      } else {
        // Saved; show what is left by reloading the requirements.
        window.location.assign(`/care/intake/${encounterId}?saved=1`);
      }

      return;
    }

    if (response?.status === 409) {
      setOutcome('not-waiting');

      return;
    }

    if (response?.status === 422 || response?.status === 413) {
      // An error for a field this form renders goes beside it; anything else
      // (e.g. "add at least one item") goes to the form banner, never nowhere.
      const known = new Set(
        [...photos.map((item) => PHOTO_SLUGS[item.slug]), ...inputs.flatMap((item) => FIELD_INPUTS[item.slug].map((spec) => spec.name))]
      );
      const mapped = {};
      const loose = [];

      for (const [rawName, messages] of Object.entries(payload?.errors ?? {})) {
        const name = rawName === 'id_upload' ? 'id_front' : rawName;
        const text = Array.isArray(messages) ? messages[0] : String(messages);

        if (known.has(name)) mapped[name] = text;
        else loose.push(text);
      }

      if (loose.length > 0 || Object.keys(mapped).length === 0) {
        mapped.form = loose.length > 0 ? loose.join(' ') : (payload?.message ?? 'Please check what you entered.');
      }

      setErrors(mapped);

      return;
    }

    setReference(payload?.request_id ?? null);
    setErrors({ form: 'We couldn’t send that. Please try again — sending again won’t create duplicates.' });
  }

  if (outcome === 'released') {
    return (
      <div className="prx-card" role="status">
        <h2>Sent — thank you</h2>
        <p className="prx-muted">Everything your visit needed is in. Your provider can now review it.</p>
        <p>
          <a className="prx-task__cta" href="/">
            Back to your care
          </a>
        </p>
      </div>
    );
  }

  if (outcome === 'not-waiting') {
    return (
      <div className="prx-card" role="status">
        <h2>This visit isn&rsquo;t waiting on you any more</h2>
        <p className="prx-muted">Your care team has already picked it up.</p>
        <p>
          <a className="prx-task__cta" href="/">
            Back to your care
          </a>
        </p>
      </div>
    );
  }

  return (
    <form className="prx-card prx-form" onSubmit={onSubmit} encType="multipart/form-data">
      <h2>Send what&rsquo;s needed</h2>

      {photos.map((item) => {
        const name = PHOTO_SLUGS[item.slug];

        return (
          <div className="prx-field" key={item.slug}>
            <label htmlFor={name}>{item.label}</label>
            <input
              id={name}
              name={name}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={errors[name] ? `${name}-hint ${name}-error` : `${name}-hint`}
            />
            <p id={`${name}-hint`} className="prx-muted prx-field__hint">A clear photo, JPEG, PNG or WebP, under 10 MB.</p>
            {errors[name] ? <p id={`${name}-error`} className="prx-field__error" role="alert">{errors[name]}</p> : null}
          </div>
        );
      })}

      {inputs.map((item) => {
        const specs = FIELD_INPUTS[item.slug];
        const fields = specs.map((spec) => (
          <div className="prx-field" key={`${item.slug}-${spec.name}`}>
            <label htmlFor={spec.name}>{specs.length === 1 ? item.label : spec.label}</label>
            <input
              id={spec.name}
              name={spec.name}
              type={spec.type ?? 'text'}
              inputMode={spec.inputMode}
              autoComplete={spec.autoComplete}
              aria-describedby={errors[spec.name] ? `${spec.name}-error` : undefined}
            />
            {errors[spec.name] ? <p id={`${spec.name}-error`} className="prx-field__error" role="alert">{errors[spec.name]}</p> : null}
          </div>
        ));

        // A multi-input item (address, measurements) keeps the operator's or
        // provider's wording as the group's legend.
        return specs.length === 1 ? (
          fields
        ) : (
          <fieldset className="prx-fieldset" key={item.slug}>
            <legend>{item.label}</legend>
            {fields}
          </fieldset>
        );
      })}

      {unhandled.length > 0 ? (
        <div className="prx-field">
          <p className="prx-muted">These need your care team — send them a message:</p>
          <ul className="prx-rows">
            {unhandled.map((item) => (
              <li className="prx-row" key={item.slug}>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {errors.form ? <p className="prx-field__error" role="alert">{errors.form}</p> : null}
      <Reference id={reference} />

      {photos.length + inputs.length > 0 ? (
        <button type="submit" className="prx-task__cta prx-form__submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send'}
        </button>
      ) : (
        <a className="prx-task__cta" href="/talk">
          Message your care team
        </a>
      )}
    </form>
  );
}
