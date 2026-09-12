/** @type {import('next').NextConfig} */
const nextConfig = {
  // Media is served from the admin's origin under a short-lived credential, so
  // the optimizer would have to hold that credential to fetch it. It does not,
  // and it caches what it fetches — both wrong for an authenticated portal.
  images: { unoptimized: true },

  // Applied to EVERY route, including the API routes and any error page. The
  // portal has no cacheable surface at all: there is no anonymous page, and a
  // patient's view must never be served to another request.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
          // Every authenticated URL here can carry an identifier in its path.
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
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
    ];
  },
};

export default nextConfig;
