import { fetchFontFile, isFontFile } from '@/lib/fonts';

/** GET /fonts/file/…: one font file from fonts.gstatic.com, relayed. See lib/fonts.js. */
export async function GET(_request, { params }) {
  const path = ((await params).path ?? []).join('/');

  if (!isFontFile(path)) return new Response(null, { status: 404 });

  let file = null;
  try {
    file = await fetchFontFile(path);
  } catch {
    file = null;
  }

  if (!file) return new Response(null, { status: 404 });

  return new Response(file.body, { headers: { 'Content-Type': file.type } });
}
