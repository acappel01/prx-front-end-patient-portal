'use client';

import Reference from '@/components/ui/Reference';

/**
 * What a patient sees when a screen fails to render at all — the error
 * boundaries' one body (`app/(portal)/error.jsx`, `app/error.jsx`,
 * `app/global-error.jsx`).
 *
 * Screens handle the admin's refusals themselves (lib/adminApi.js never
 * throws), so reaching here is a bug or an outage, never the patient's doing.
 * It says so plainly, offers a way forward, and shows Next's error digest as
 * the Reference: an opaque hash that matches the server log line, nothing
 * clinical. Nothing is logged from the browser; the server already logged it.
 */
export default function ErrorState({ digest, onRetry, home = '/' }) {
  return (
    <div className="prx-error" role="alert">
      <h1>We can&rsquo;t load this right now</h1>
      <p className="prx-muted">Something went wrong on our side. Your information is safe. Please try again in a moment.</p>
      <p className="prx-error__actions">
        <button type="button" className="prx-task__cta prx-task__cta--primary" onClick={onRetry}>
          Try again
        </button>
        <a className="prx-task__cta" href={home}>
          Go to your care
        </a>
      </p>
      <Reference id={digest ?? null} />
    </div>
  );
}
