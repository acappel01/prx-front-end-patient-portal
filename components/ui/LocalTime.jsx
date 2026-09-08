'use client';

import { useEffect, useState } from 'react';

/**
 * An instant, shown in the reader's own timezone.
 *
 * There is no server-side option here that is not wrong. Formatting on the
 * server uses the SERVER's timezone, which for a patient a few hours away is
 * the wrong time and, close to midnight, the wrong DAY — the same class of
 * defect as the provider's scheduling bug, arrived at from the other end. So
 * the server renders the raw ISO string, which is unambiguous, and the browser
 * replaces it on mount with the only timezone that is definitely right.
 *
 * Safe to do here and not for a visit time: `created_at` carries a real offset
 * (`…+00:00`), so it names one instant. A NAIVE timestamp must never be run
 * through this — it has no instant to convert, and guessing one is the bug.
 */
export default function LocalTime({ value }) {
  // Starts as the server's output so the first paint matches and React has no
  // hydration mismatch to warn about.
  const [text, setText] = useState(value);

  useEffect(() => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return;

    setText(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    );
  }, [value]);

  return <time dateTime={value}>{text}</time>;
}
