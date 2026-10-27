import { deploymentConfig } from '@/lib/adminApi';
import { fetchFontStylesheet, fontStylesheetUrl } from '@/lib/fonts';

/**
 * GET /fonts/stylesheet: the admin's font stylesheet, relayed. See lib/fonts.js.
 * Anything that goes wrong answers an empty stylesheet, so the page renders in
 * the system font stack instead of logging a failed request.
 */
export async function GET() {
  const url = fontStylesheetUrl(await deploymentConfig());
  let css = null;

  if (url) {
    try {
      css = await fetchFontStylesheet(url);
    } catch {
      css = null;
    }

    if (css === null) console.warn('[fonts] the font stylesheet could not be relayed; the system fonts apply');
  }

  return new Response(css ?? '', {
    headers: { 'Content-Type': 'text/css; charset=utf-8' },
  });
}
