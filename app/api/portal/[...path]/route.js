import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
import { isAllowed, safePath } from '@/lib/portalProxy';
import { rateLimitReply } from '@/lib/rateLimit';
import { LIMITS, guardRequest, readBody } from '@/lib/requestGuard';
import { sessionToken } from '@/lib/session';

/**
 * Same-origin proxy: browser → here → admin.
 *
 * The session cookie never leaves this origin and the patient token never
 * reaches the browser. Only the paths in `lib/portalProxy.js` are reachable.
 *
 * Query strings are forwarded; request bodies are forwarded verbatim. That is
 * safe here and only here, because the admin's PortalController re-validates
 * every field and pins every identifier to the session's own record. This
 * proxy's job is to decide WHETHER a path is reachable, not to re-implement
 * the admin's validation — two copies of a rule is two chances to disagree.
 */

export const dynamic = 'force-dynamic';

async function handle(request, context, method) {
  // Writes only: a cross-origin GET cannot read the answer, and the reads
  // here change nothing.
  if (method !== 'GET') {
    const refused = guardRequest(request, { maxBytes: LIMITS.proxy });
    if (refused) return refused;
  }

  const { path } = await context.params;

  const resolved = safePath(path);

  if (!resolved || !isAllowed(method, resolved)) {
    // Deliberately indistinguishable from a path that does not exist. Whether
    // an admin endpoint is real is not something an unauthenticated caller
    // should be able to enumerate through us.
    return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  }

  const token = await sessionToken();

  if (!token) {
    return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });
  }

  const search = new URL(request.url).search;

  let body;
  if (method !== 'GET' && method !== 'DELETE') {
    const read = await readBody(request, { maxBytes: LIMITS.proxy });
    if (read.response) return read.response;
    body = read.body;
  }

  const result = await adminFetch(`${resolved}${search}`, { method, body, token });

  if (result.status === 0) {
    // A timeout or reset on the way to the admin (adminFetch logged the path).
    // The admin may have acted (an approval may have charged), so this is "we
    // do not know", never a refusal: a named code the screens treat as
    // uncertain, not a bodiless 500.
    return NextResponse.json(
      { message: 'We could not reach the service, so we do not know whether that went through.', code: 'upstream_unreachable' },
      { status: 504 }
    );
  }

  if (result.status === 429) {
    // The wait is passed on, and the message is the shared one, so a form that
    // shows the answer's message tells the patient how long to wait instead of
    // inviting a retry straight into the limiter.
    const reply = rateLimitReply(result.retryAfter);

    return NextResponse.json({ ...reply.body, ...(result.requestId ? { request_id: result.requestId } : {}) }, { status: 429, headers: reply.headers });
  }

  if (result.ok) {
    // `message` rides a success too: the claim-link request answers 202 with
    // the one sentence a patient sees whether or not an order matched, and a
    // screen inventing its own copy would be free to drift from that promise.
    return NextResponse.json(
      { data: result.data, meta: result.meta, ...(result.message ? { message: result.message } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json(
    {
      message: result.message ?? 'Request failed.',
      // Forwarded only when the admin sent one, which it does only on a 422 —
      // where it is the field-keyed validation array a form needs to point at
      // the input. The admin already replaces the upstream provider's message
      // and stack with its own on every 5xx, so nothing here is a passthrough
      // of anything the provider wrote.
      ...(result.errors ? { errors: result.errors } : {}),
      ...(result.code ? { code: result.code } : {}),
      ...(result.requestId ? { request_id: result.requestId } : {}),
    },
    { status: result.status }
  );
}

export const GET = (request, context) => handle(request, context, 'GET');
export const POST = (request, context) => handle(request, context, 'POST');
