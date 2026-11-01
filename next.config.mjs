/** @type {import('next').NextConfig} */
const nextConfig = {
  // Media is served from the admin's origin under a short-lived credential, so
  // the optimizer would have to hold that credential to fetch it. It does not,
  // and it caches what it fetches — both wrong for an authenticated portal.
  images: { unoptimized: true },

  // Applied to EVERY route, including the API routes and any error page. The
  // portal has no cacheable surface apart from the relayed brand fonts (below):
  // the few anonymous pages (sign in, register, forgot, and the emailed-link
  // pages) are per-visitor forms, and a patient's view must never be served to
  // another request.
  //
  // Content-Security-Policy, Strict-Transport-Security and Permissions-Policy
  // are NOT here: they are set per request by middleware.js, because the CSP
  // carries a fresh nonce and reads the deployment's env (lib/securityHeaders.js),
  // and this function is evaluated once, at build time.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          // Every authenticated URL here can carry an identifier in its path.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // Every route but the relayed font files. A header set here wins over
        // one a route handler sets, so the font route sets its own: immutable
        // for a real file, no-store for a refusal. A 404 cached for a year
        // would hide that file from the browser after a brand font change.
        source: '/:path((?!fonts/file/).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private, max-age=0' }],
      },
      {
        // A claim page carries a single-use token in its path. `same-origin`
        // still sends that URL as the Referer on every same-origin fetch the
        // page makes — including the sign-in and the claim itself — and the
        // access log records Referers. Later entries override earlier ones
        // for the same key.
        source: '/claim/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        // The emailed create-account and reset links carry a single-use token
        // in their path too, for the same reason as a claim page.
        source: '/create-account/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/reset/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        // The stylesheet URL carries the theme version, so a font change
        // reaches browsers at once. (The font files' caching is set by
        // app/fonts/file/[...path]/route.js, see above.)
        source: '/fonts/stylesheet',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
