'use client';

import { useEffect, useRef, useState } from 'react';

import Reference from '@/components/ui/Reference';
import { fieldErrors, portalCall } from '@/lib/portalClient';

/**
 * Medications, allergies and conditions, kept accurate by the patient.
 *
 * Each list is the clinical provider's record, read live; an add or a remove
 * goes straight to it. A name is picked from the provider's list of known
 * names where one matches (so the record carries a proper code) or typed
 * freely where none does. Nothing typed here leaves the page except to the
 * admin, which forwards only the fields a patient may set.
 */
const KINDS = [
  {
    key: 'medications',
    title: 'Medications',
    noun: 'medication',
    article: 'a',
    nameField: 'medication_name',
    termField: 'terminology_medication_id',
    empty: 'No medications recorded.',
    detail: (entry) => [entry.dosage, entry.frequency].filter(Boolean).join(', '),
    fields: [
      { name: 'dosage', label: 'Dose', placeholder: 'e.g. 10 mg' },
      { name: 'frequency', label: 'How often', placeholder: 'e.g. once a day' },
    ],
  },
  {
    key: 'allergies',
    title: 'Allergies',
    noun: 'allergy',
    article: 'an',
    nameField: 'allergy_name',
    termField: 'terminology_allergy_id',
    empty: 'No allergies recorded.',
    detail: (entry) => [entry.allergy_reaction, entry.allergy_severity && entry.allergy_severity !== 'unknown' ? entry.allergy_severity : null].filter(Boolean).join(', '),
    fields: [
      { name: 'allergy_reaction', label: 'What happens', placeholder: 'e.g. hives' },
      {
        name: 'allergy_severity',
        label: 'How bad',
        options: [
          ['', 'Not sure'],
          ['mild', 'Mild'],
          ['moderate', 'Moderate'],
          ['severe', 'Severe'],
        ],
      },
    ],
  },
  {
    key: 'conditions',
    title: 'Conditions',
    noun: 'condition',
    article: 'a',
    nameField: 'condition_name',
    termField: 'terminology_condition_id',
    empty: 'No conditions recorded.',
    detail: (entry) => entry.condition_notes ?? '',
    fields: [{ name: 'condition_notes', label: 'Notes', placeholder: 'Optional' }],
  },
];

export default function HealthRecordManager({ record }) {
  return (
    <>
      {KINDS.map((kind) => (
        <HealthList key={kind.key} kind={kind} initial={record?.[kind.key] ?? []} />
      ))}
    </>
  );
}

function HealthList({ kind, initial }) {
  const [entries, setEntries] = useState(initial);
  const [adding, setAdding] = useState(false);

  return (
    <section className="prx-card prx-health-list" aria-labelledby={`prx-${kind.key}-heading`}>
      <h2 id={`prx-${kind.key}-heading`}>{kind.title}</h2>
      {entries.length === 0 ? <p className="prx-muted">{kind.empty}</p> : null}
      <ul className="prx-rows">
        {entries.map((entry) => (
          <Entry
            key={entry.id}
            kind={kind}
            entry={entry}
            onRemoved={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
          />
        ))}
      </ul>
      {adding ? (
        <AddForm
          kind={kind}
          onCancel={() => setAdding(false)}
          onAdded={(entry) => {
            setEntries((current) => [...current, entry]);
            setAdding(false);
          }}
        />
      ) : (
        <button type="button" className="prx-link" onClick={() => setAdding(true)}>
          Add {kind.article} {kind.noun}
        </button>
      )}
    </section>
  );
}

function Entry({ kind, entry, onRemoved }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const response = await portalCall(`/patient/health-record/${kind.key}/${entry.id}/remove`, { method: 'POST' });
    setBusy(false);

    if (response.ok || response.status === 404) {
      onRemoved();

      return;
    }

    setError(response.message ?? 'We couldn’t remove it. Please try again.');
  }

  const detail = kind.detail(entry);

  return (
    <li className="prx-row">
      <span>
        <strong>{entry[kind.nameField]}</strong>
        {detail ? (
          <>
            <br />
            <span className="prx-row__meta">{detail}</span>
          </>
        ) : null}
        {error ? (
          <span className="prx-field__error" role="alert">
            {' '}
            {error}
          </span>
        ) : null}
      </span>
      {confirming ? (
        <span className="prx-health-list__confirm">
          <button type="button" className="prx-link" onClick={remove} disabled={busy}>
            {busy ? 'Removing…' : 'Remove'}
          </button>
          <button type="button" className="prx-link" onClick={() => setConfirming(false)} disabled={busy}>
            Keep
          </button>
        </span>
      ) : (
        <button type="button" className="prx-link" onClick={() => setConfirming(true)} aria-label={`Remove ${entry[kind.nameField]}`}>
          Remove
        </button>
      )}
    </li>
  );
}

function AddForm({ kind, onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState(null);
  const [matches, setMatches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [reference, setReference] = useState(null);
  const searchRun = useRef(0);

  // Suggestions from the provider's list after two characters, a quarter
  // second after the patient stops typing. A stale answer never replaces a
  // newer one.
  useEffect(() => {
    if (picked || name.trim().length < 2) {
      setMatches([]);

      return undefined;
    }

    const run = ++searchRun.current;
    const timer = setTimeout(async () => {
      const response = await portalCall(`/patient/health-record/${kind.key}/search`, { method: 'POST', body: { q: name.trim() } });

      if (run === searchRun.current) setMatches(response.ok ? (response.data ?? []).slice(0, 8) : []);
    }, 250);

    return () => clearTimeout(timer);
  }, [name, picked, kind.key]);

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const body = { [kind.nameField]: name.trim() };

    if (picked) body[kind.termField] = picked.id;
    for (const field of kind.fields) body[field.name] = String(form.get(field.name) ?? '').trim();

    setBusy(true);
    setErrors({});
    setReference(null);
    const response = await portalCall(`/patient/health-record/${kind.key}`, { method: 'POST', body });
    setBusy(false);

    if (response.ok && response.data) {
      onAdded(response.data);

      return;
    }

    if (response.status === 422) {
      const mapped = fieldErrors(response.errors);
      // A missing name is reported on the name field, whichever key carried it.
      if (mapped[kind.termField] && !mapped[kind.nameField]) mapped[kind.nameField] = mapped[kind.termField];
      setErrors(Object.keys(mapped).length > 0 ? mapped : { form: response.message ?? 'Please check what you entered.' });

      return;
    }

    setReference(response.status >= 500 ? response.requestId : null);
    setErrors({ form: response.message ?? 'We couldn’t add it. Please try again.' });
  }

  const nameId = `prx-${kind.key}-name`;

  return (
    <form className="prx-form prx-health-list__add" onSubmit={onSubmit} noValidate>
      <div className="prx-field">
        <label htmlFor={nameId}>{kind.noun.charAt(0).toUpperCase() + kind.noun.slice(1)}</label>
        <input
          id={nameId}
          type="text"
          autoComplete="off"
          value={name}
          maxLength={255}
          onChange={(event) => {
            setName(event.target.value);
            setPicked(null);
          }}
          aria-describedby={errors[kind.nameField] ? `${nameId}-error` : undefined}
          aria-autocomplete="list"
          aria-controls={matches.length > 0 ? `${nameId}-matches` : undefined}
          required
        />
        {matches.length > 0 ? (
          <ul id={`${nameId}-matches`} className="prx-health-list__matches" role="listbox" aria-label="Matching names">
            {matches.map((match) => (
              <li key={match.id} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => {
                    setPicked(match);
                    setName(match.patient_friendly_name || match.name || match.display);
                    setMatches([]);
                  }}
                >
                  {match.display || match.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {errors[kind.nameField] ? (
          <p id={`${nameId}-error`} className="prx-field__error" role="alert">
            {errors[kind.nameField]}
          </p>
        ) : null}
      </div>

      {kind.fields.map((field) => {
        const id = `prx-${kind.key}-${field.name}`;

        return (
          <div className="prx-field" key={field.name}>
            <label htmlFor={id}>{field.label}</label>
            {field.options ? (
              <select id={id} name={field.name} defaultValue="">
                {field.options.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <input id={id} name={field.name} type="text" maxLength={field.name.endsWith('notes') ? 1000 : 255} placeholder={field.placeholder} />
            )}
            {errors[field.name] ? (
              <p className="prx-field__error" role="alert">
                {errors[field.name]}
              </p>
            ) : null}
          </div>
        );
      })}

      {errors.form ? (
        <p className="prx-field__error" role="alert">
          {errors.form}
        </p>
      ) : null}
      <Reference id={reference} />

      <div className="prx-approval__actions">
        <button type="submit" className="prx-task__cta prx-task__cta--primary" disabled={busy || name.trim() === ''}>
          {busy ? 'Adding…' : `Add ${kind.article} ${kind.noun}`}
        </button>
        <button type="button" className="prx-link" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
