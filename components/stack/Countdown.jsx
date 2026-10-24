'use client';

import { useEffect, useState } from 'react';

/**
 * A live countdown for a tier-0 task.
 *
 * Announced through a polite live region rather than silently repainted, so a
 * screen-reader user is told the visit is starting. It updates once a minute
 * under a minute-granularity format — a per-second announcement would be
 * unusable, which is why the seconds view is capped to the final five minutes.
 *
 * Renders the server's own text until mounted, so the markup does not differ
 * between server and client and there is no hydration flash.
 */
const plural = (count, unit) => `in ${count} ${unit}${count === 1 ? '' : 's'}`;

/**
 * Seconds for the last five minutes, minutes up to the hour, hours up to two
 * days, then days. An approval window is 48 hours, and "in 1798 min" is a
 * number nobody can read at a glance.
 */
function format(remaining) {
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (minutes < 5) return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
  if (minutes < 60) return `in ${minutes} min`;
  if (hours < 48) return plural(hours, 'hour');

  return plural(Math.floor(hours / 24), 'day');
}

export default function Countdown({ deadline, fallback }) {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    if (!deadline) return undefined;

    const target = new Date(deadline).getTime();

    if (Number.isNaN(target)) return undefined;

    const tick = () => {
      const remaining = target - Date.now();

      if (remaining <= 0) {
        setLabel('now');

        return;
      }

      setLabel(format(remaining));
    };

    tick();

    // One second while it matters, one minute once it does not.
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span role="status" aria-live="polite">
      {label}
    </span>
  );
}
