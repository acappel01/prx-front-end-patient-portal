import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
import { isAllowed, safePath } from '@/lib/portalProxy';
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
    body = await request.json().catch(() => null);
  }

  const result = await adminFetch(`${resolved}${search}`, { method, body, token });

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
    },
    { status: result.status }
  );
}

export const GET = (request, context) => handle(request, context, 'GET');
export const POST = (request, context) => handle(request, context, 'POST');
