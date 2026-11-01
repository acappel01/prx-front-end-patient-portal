import { NextResponse } from 'next/server';

import { TIMEOUT_MS, adminFetch } from '@/lib/adminApi';
import { rateLimitReply } from '@/lib/rateLimit';
import { guardRequest, readBody } from '@/lib/requestGuard';
import { sessionToken } from '@/lib/session';

/**
 * Send what a held visit needs — the one multipart upload in the app.
 *
 * NOT through the generic proxy, which parses JSON only and would have to
 * buffer 40 MB behind an allowlist check. This route reads the body with a hard
 * cap, keeps only the named fields and photos it expects, gives files neutral
 * names (the patient's own filename is not the provider's business), and sends
 * a freshly built form to the admin, which validates everything again.
 *
 * Nothing is stored here: the bytes pass through memory for this request only.
 */

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;
const MAX_BODY = 42 * 1024 * 1024;
const MAX_FILE = 10 * 1024 * 1024;
const PHOTOS = ['id_front', 'id_back', 'selfie_photo', 'body_photo'];
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const FIELDS = [
  'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'email',
  'address_street1', 'address_street2', 'address_city', 'address_state', 'address_zip',
  'weight', 'height_feet', 'height_inches', 'drivers_license_number', 'drivers_license_state',
];

const TOO_LARGE = 'Those photos are too large. Each must be under 10 MB.';
const BODY = { kind: 'multipart', maxBytes: MAX_BODY, tooLargeMessage: TOO_LARGE };

function tooLarge() {
  return NextResponse.json({ message: TOO_LARGE }, { status: 413 });
}

export async function POST(request, context) {
  // Origin, multipart type and the declared size; the body is read below,
  // after the session check, so nobody unauthenticated makes us buffer it.
  const refused = guardRequest(request, BODY);
  if (refused) return refused;

  const { id } = await context.params;

  if (!UUID.test(id)) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  if (!(await sessionToken())) return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });

  const read = await readBody(request, BODY);
  if (read.response) return read.response;

  let incoming;
  try {
    incoming = await new Response(read.body, { headers: { 'content-type': request.headers.get('content-type') } }).formData();
  } catch {
    return NextResponse.json({ message: 'We couldn’t read that form.' }, { status: 400 });
  }

  const outgoing = new FormData();

  for (const name of FIELDS) {
    const value = incoming.get(name);

    if (typeof value === 'string' && value.trim() !== '') outgoing.append(name, value.trim().slice(0, 255));
  }

  for (const name of PHOTOS) {
    const file = incoming.get(name);

    if (!file || typeof file === 'string' || file.size === 0) continue;
    if (file.size > MAX_FILE) return tooLarge();

    const extension = TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        { message: 'Photos must be JPEG, PNG or WebP.', errors: { [name]: ['Photos must be JPEG, PNG or WebP.'] } },
        { status: 422 }
      );
    }

    outgoing.append(name, new Blob([await file.arrayBuffer()], { type: file.type }), `${name}.${extension}`);
  }

  // The admin waits up to 120 s on the provider for this upload, so the limit
  // here sits just past that (TIMEOUT_MS.upload) rather than at a read's 15 s.
  const result = await adminFetch(`/patient/encounters/${id}/provide-information`, {
    method: 'POST',
    body: outgoing,
    timeout: TIMEOUT_MS.upload,
  });

  if (result.status === 0) {
    // Sending again is safe: the provider does not duplicate what is on file.
    return NextResponse.json({ message: 'We couldn’t reach the server. Please try again.' }, { status: 503 });
  }

  if (result.status === 429) {
    const reply = rateLimitReply(result.retryAfter);

    return NextResponse.json(reply.body, { status: 429, headers: reply.headers });
  }

  return NextResponse.json(
    result.ok
      ? { data: result.data }
      : {
          message: result.message ?? 'That could not be sent.',
          ...(result.errors ? { errors: result.errors } : {}),
          ...(result.code ? { code: result.code } : {}),
          ...(result.requestId ? { request_id: result.requestId } : {}),
        },
    { status: result.status }
  );
}
