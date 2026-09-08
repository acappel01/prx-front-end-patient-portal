export const dynamic = 'force-dynamic';

/**
 * Nothing here is for a crawler, ever.
 *
 * Every response already carries `X-Robots-Tag: noindex, nofollow, noarchive,
 * nosnippet`, which is the stronger signal — it prevents INDEXING even for a
 * crawler that fetched the page anyway. This file is the other half: it asks
 * well-behaved crawlers not to fetch in the first place, which keeps them out
 * of the access log and off the login endpoint's rate limiter.
 *
 * There is no sitemap and there will not be one. Every route in this app is
 * behind a session.
 */
export function GET() {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
