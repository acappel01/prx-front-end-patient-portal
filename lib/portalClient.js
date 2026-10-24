/**
 * The browser side of the same-origin proxy (`app/api/portal`), for client
 * components. One place decides what a 401 means (sign in again) and how a
 * response is unwrapped, so no form re-implements it.
 *
 * Never throws: a network failure comes back as `{ ok: false, status: 0 }`,
 * which each caller must treat as "we do not know what happened" — for a
 * charge that is the uncertain case, not a failure to retry.
 */
export async function portalCall(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api/portal${path}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch(() => null);

  if (!response) return { ok: false, status: 0, data: null };

  if (response.status === 401) {
    window.location.assign('/login');

    return { ok: false, status: 401, data: null };
  }

  const payload = await response.json().catch(() => null);

  return {
    ok: response.ok,
    status: response.status,
    data: payload?.data ?? null,
    message: payload?.message ?? null,
    errors: payload?.errors ?? null,
    code: payload?.code ?? null,
    requestId: payload?.request_id ?? null,
  };
}

/** The first message per field of a 422, keyed by field. */
export function fieldErrors(errors) {
  return Object.fromEntries(
    Object.entries(errors ?? {}).map(([name, messages]) => [name, Array.isArray(messages) ? messages[0] : String(messages)])
  );
}
