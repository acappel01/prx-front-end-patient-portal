import '@/public/scss/main.scss';

import { headers } from 'next/headers';

import { deploymentConfig } from '@/lib/adminApi';
import { fontStylesheetHref } from '@/lib/fonts';
import { PAYMENT_CSP_ATTRIBUTE, PAYMENT_CSP_HEADER } from '@/lib/paymentPage';
import { warnIfImageBlocked } from '@/lib/securityHeaders';
import { brandFavicon, brandLogo, brandName, customCss, themeStyle } from '@/lib/theme';

/**
 * Universal shell.
 *
 * Deliberately minimal, and deliberately NOT shared with the storefront. The
 * storefront injects operator-pasted tracking snippets unsanitized — a real
 * feature there. Sharing a root layout would run third-party script on a page
 * rendering prescriptions. There is no script tag in this file and no
 * third-party host anywhere in this application: the admin's brand fonts are
 * relayed through this origin (lib/fonts.js), never linked from a font CDN.
 * The Content-Security-Policy (middleware.js, lib/securityHeaders.js) enforces
 * that in the browser: Next's own inline bootstrap carries the request's nonce,
 * and nothing else may run.
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
  const fonts = fontStylesheetHref(config);
  const favicon = brandFavicon(config);
  const custom = customCss(config);
  // Which policy the middleware served this document under (lib/paymentPage.js).
  const paymentCsp = (await headers()).get(PAYMENT_CSP_HEADER) === 'on' ? 'on' : 'off';

  // A brand image from a host the policy does not name would silently not
  // show; say so in the log instead.
  warnIfImageBlocked(brandLogo(config)?.url, 'brand logo');
  warnIfImageBlocked(favicon, 'favicon');

  return (
    <html
      lang="en"
      data-app="portal"
      data-template={config?.theme?.frontend_template ?? 'default'}
      {...{ [PAYMENT_CSP_ATTRIBUTE]: paymentCsp }}
    >
      <head>
        {fonts ? <link rel="stylesheet" href={fonts} /> : null}
        {favicon ? <link rel="icon" href={favicon} /> : null}
        <style>{`:root{${themeStyle(config)}}`}</style>
        {custom ? <style>{custom}</style> : null}
        {/* `brand.name`, not `site.name` — there is no `site` key on the payload. */}
        <title>{brandName(config)}</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
