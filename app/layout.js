import '@/public/scss/main.scss';

import { deploymentConfig } from '@/lib/adminApi';
import { brandName, themeStyle } from '@/lib/theme';

/**
 * Universal shell.
 *
 * Deliberately minimal, and deliberately NOT shared with the storefront. The
 * storefront injects operator-pasted tracking snippets unsanitized — a real
 * feature there. Sharing a root layout would run third-party script on a page
 * rendering prescriptions. There is no script tag in this file and no
 * third-party host anywhere in this application; fonts are system stacks or
 * self-hosted, never fetched from a font CDN on an authenticated page.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  // A patient portal must never be indexed. `next.config.mjs` sets the header
  // too — this is the second of the two, because a header can be stripped by a
  // proxy and a meta tag cannot.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never disable zoom on a clinical screen: dose text has to be legible to
  // someone who needs it larger.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  // Non-PHI and identical for every visitor, so this is the one thing the app
  // caches. Everything patient-specific is fetched per request.
  const config = await deploymentConfig();

  return (
    <html lang="en" style={{ cssText: undefined }} data-template={config?.theme?.frontend_template ?? 'default'}>
      <head>
        <style>{`:root{${themeStyle(config)}}`}</style>
        {/* `brand.name`, not `site.name` — there is no `site` key on the payload. */}
        <title>{brandName(config)}</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
