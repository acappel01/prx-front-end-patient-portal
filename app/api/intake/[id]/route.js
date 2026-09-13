import { NextResponse } from 'next/server';

import { adminFetch } from '@/lib/adminApi';
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

async function readCapped(request, limit) {
  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    total += value.byteLength;

    if (total > limit) {
      await reader.cancel();

      return null;
    }

    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return out;
}

function tooLarge() {
  return NextResponse.json({ message: 'Those photos are too large. Each must be under 10 MB.' }, { status: 413 });
}

export async function POST(request, context) {
  const { id } = await context.params;

  if (!UUID.test(id)) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  if (!(await sessionToken())) return NextResponse.json({ message: 'Unauthenticated.' }, { status: 401 });

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return tooLarge();

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ message: 'Send the form as multipart.' }, { status: 415 });
  }

  const raw = await readCapped(request, MAX_BODY);
  if (raw === null) return tooLarge();

  let incoming;
  try {
    incoming = await new Response(raw, { headers: { 'content-type': contentType } }).formData();
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

  const result = await adminFetch(`/patient/encounters/${id}/provide-information`, { method: 'POST', body: outgoing }).catch(() => null);

  if (!result) {
    return NextResponse.json({ message: 'We couldn’t reach the server. Please try again.' }, { status: 503 });
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
