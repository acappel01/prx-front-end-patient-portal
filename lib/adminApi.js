import 'server-only';

import { headers as requestHeaders } from 'next/headers';

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
 * The patient's address and browser, carried upstream.
 *
 * WHY THIS IS NOT OPTIONAL. Every call reaches the admin from this server, so
 * without it `$request->ip()` upstream is the portal host for every patient.
 * Measured on 2026-09-12: `patient_email_tokens.requested_ip` / `consumed_ip`
 * both recorded this box. And the admin's rate limiters key off the same value —
 * the login limiter is 10/min per IP, which collapses every patient signing in
 * into ONE bucket, so ten attempts anywhere lock out everyone.
 *
 * A SINGLE ADDRESS IS SENT, NOT THE CHAIN. Apache appends the true peer as the
 * RIGHTMOST entry of X-Forwarded-For, so that is the one taken; anything the
 * visitor prepended is dropped here rather than forwarded. The admin honours the
 * header only because its `TRUSTED_PROXIES` names this host.
 *
 * Next SYNTHESISES X-Forwarded-For from the socket peer when none arrives, so a
 * direct hit on 127.0.0.1:3100 yields `127.0.0.1` rather than no header. A
 * loopback value means the request did not come through Apache; it is logged,
 * not silently attributed to this server.
 *
 * If a CDN is ever put in front, the true client is no longer the rightmost
 * entry — this extraction and the admin's TRUSTED_PROXIES change together.
 * Mirrors `clientIp()` in the storefront's backend proxy route.
 */
const LOOPBACK = /^(::1|::ffff:127\.|127\.)/;

async function clientHeaders() {
  let incoming;
  try {
    incoming = await requestHeaders();
  } catch {
    // Outside a request there is no visitor to carry. Unreachable today: the
    // root layout is force-dynamic, so nothing here is ever prerendered. If that
    // changes, note this catch would also swallow Next's dynamic-usage bailout.
    return {};
  }

  const forwarded = (incoming.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const ip = forwarded.at(-1);
  const userAgent = incoming.get('user-agent');

  if (ip && LOOPBACK.test(ip)) {
    console.warn(`[adminApi] client address resolved to ${ip}; the admin will see this server as the patient`);
  }

  return {
    ...(ip ? { 'X-Forwarded-For': ip } : {}),
    // The admin names a patient's API token after the browser that signed in.
    ...(userAgent ? { 'User-Agent': userAgent } : {}),
  };
}

/**
 * One request to the admin as the signed-in patient, unparsed. adminFetch()
 * and adminDownload() both start here, so headers are built in one place.
 */
async function adminRequest(path, { method = 'GET', body, token } = {}) {
  const bearer = token ?? (await sessionToken());

  return fetch(`${baseUrl()}${path}`, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      // A FormData body sets its own multipart Content-Type with the boundary.
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      // No caller-supplied headers, deliberately: a case-variant
      // `x-forwarded-for` would not replace this one, it would be COMBINED into
      // a chain the admin resolves to the caller's value.
      ...(await clientHeaders()),
    },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
}

/**
 * A file from the admin (a copy of the record), as the raw response, for a
 * route handler to stream on. Never cached, like everything else here.
 */
export async function adminDownload(path) {
  return adminRequest(path);
}

/**
 * Call the admin as the signed-in patient.
 *
 * Returns `{ ok, status, data }` rather than throwing on an HTTP error, so a
 * screen can render a real empty state instead of a 500. A 401 is a normal
 * outcome here — the admin's patient token expires — and callers surface it as
 * re-authentication, never as a failure.
 */
export async function adminFetch(path, options = {}) {
  const response = await adminRequest(path, options);

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
    // A machine-readable reason the admin sends with some refusals — today only
    // `two_factor_setup_required` on a 403 — so a screen can route instead of
    // showing an error.
    code: payload?.code ?? null,
    // The admin's correlation id for this request (body on provider failures,
    // `X-Request-ID` header on every API response). Shown to a patient only on a 5xx, as "Reference",
    // so support can find the request in the admin's and the provider's logs.
    requestId: payload?.request_id ?? response.headers.get('x-request-id') ?? null,
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

    if (!response.ok) {
      // Said out loud: an unbranded portal is otherwise the only symptom, and
      // it looks like a styling bug rather than a refused call.
      console.warn(
        `[config] admin answered HTTP ${response.status} on /config, so the portal renders unbranded. ` +
          'Check ADMIN_API_BASE_URL is the admin (not the storefront) and ADMIN_API_TOKEN has Public read.'
      );

      return null;
    }

    const payload = await response.json().catch(() => null);

    if (!payload?.data) console.warn('[config] /config answered without a data object, so the portal renders unbranded.');

    return payload?.data ?? null;
  } catch (error) {
    // Falls through to the neutral defaults in lib/theme.js.
    console.warn(`[config] could not reach the admin for /config (${error?.name ?? 'error'}), so the portal renders unbranded.`);

    return null;
  }
}
