import { NextResponse } from 'next/server';

import { adminDownload } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

/**
 * Streams a ready copy of the record from the admin to the browser.
 *
 * The admin's JSON proxy cannot carry a file, so this is its own route: the
 * session cookie authenticates it, the id is matched as a uuid, and the admin
 * scopes the export to the session's own chart. The file passes through;
 * nothing is written here, and the response is never cached.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F-]{36}$/;

export async function GET(request, context) {
  const { id } = await context.params;

  if (!UUID.test(id)) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  if (!(await sessionToken())) return NextResponse.redirect(new URL('/login', request.url));

  const upstream = await adminDownload(`/patient/export/${id}/download`).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return NextResponse.json({ message: 'That copy is not available. Please ask for a new one.' }, { status: upstream?.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-health-record.json"',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}
