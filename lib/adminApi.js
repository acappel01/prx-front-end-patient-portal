import 'server-only';

import { sessionToken } from '@/lib/session';

/**
 * The only thing in this app that talks to the admin.
 *
 * Everything clinical arrives through here, server-side. There is no browser
 * path to the admin and no `NEXT_PUBLIC_` base URL, because a base URL in the
 * bundle is what forces an API to stay publicly reachable.
 *
 * Nothing here is cached. `no-store` is set on every call rather than left to
 * a default, because Next's fetch cache is shared across requests: one
 * patient's dashboard served to the next patient is exactly the failure this
 * whole application is shaped to avoid. There is no ISR in this app, ever.
 */

function baseUrl() {
  const value = process.env.ADMIN_API_BASE_URL;

  if (!value) throw new Error('ADMIN_API_BASE_URL is not configured.');

  return value.replace(/\/$/, '');
}

/**
 * Call the admin as the signed-in patient.
 *
 * Returns `{ ok, status, data }` rather than throwing on an HTTP error, so a
 * screen can render a real empty state instead of a 500. A 401 is a normal
 * outcome here — the admin's patient token expires — and callers surface it as
 * re-authentication, never as a failure.
 */
export async function adminFetch(path, { method = 'GET', body, token, headers = {} } = {}) {
  const bearer = token ?? (await sessionToken());

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON body from the admin is a bug upstream, not something to crash
    // a clinical screen over. Fall through with null and let the caller render
    // its empty state.
  }

  return {
    ok: response.ok,
    status: response.status,
    // The admin's envelope is `{ data, meta?, message?, errors? }`. Unwrap it
    // once, here, so no screen has to know the envelope exists.
    data: payload?.data ?? null,
    meta: payload?.meta ?? null,
    message: payload?.message ?? null,
    // `errors` is the field-keyed validation array on a 422, and dropping it
    // is not a cosmetic loss. It is the entire difference between a form that
    // says "check the weight" and one that says "something was wrong" — and
    // on the vitals endpoint that second message is indistinguishable from
    // the failure where the row WAS written and must not be resubmitted.
    errors: payload?.errors ?? null,
  };
}

/**
 * Deployment configuration and branding. This is the ONE call in the app that
 * is not patient-specific, and it is the only one that may be cached — it is
 * the "cache the non-PHI half hard" half of the performance model.
 */
export async function deploymentConfig() {
  // Never throws. This runs in the ROOT LAYOUT, so a rejection here takes down
  // every route at once — and it took a build down when the admin blipped
  // during `next build`. A portal that cannot reach its admin should render
  // unbranded and say so, not fail to exist.
  try {
    const response = await fetch(`${baseUrl()}/config`, {
      headers: {
        Accept: 'application/json',
        ...(process.env.ADMIN_API_TOKEN ? { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}` } : {}),
      },
      next: { revalidate: 300, tags: ['config'] },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);

    return payload?.data ?? null;
  } catch {
    // Falls through to the neutral defaults in lib/theme.js.
    return null;
  }
}
