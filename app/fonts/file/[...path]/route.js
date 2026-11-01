import { deploymentConfig } from '@/lib/adminApi';
import { brandFontPaths, fetchFontFile, isFontFile } from '@/lib/fonts';

// The same bytes for every visitor, nothing about a patient, and Google's file
// paths are versioned, so a file never changes: cached for a year. A refusal
// is never cached, or a browser would keep the 404 after a brand font change.
// next.config.mjs leaves this route's Cache-Control to this file.
const notFound = () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * GET /fonts/file/…: one font file from fonts.gstatic.com, relayed. See
 * lib/fonts.js. Only a file the brand's own stylesheet names is served; any
 * other path is a 404, even a real Google font, so this is not an open relay
 * and the cache cannot be filled with files nobody's page uses.
 */
export async function GET(_request, { params }) {
  const path = ((await params).path ?? []).join('/');

  if (!isFontFile(path)) return notFound();

  if (!(await brandFontPaths(await deploymentConfig())).has(path)) return notFound();

  let file = null;
  try {
    file = await fetchFontFile(path);
  } catch {
    file = null;
  }

  if (!file) return notFound();

  return new Response(file.body, { headers: { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
