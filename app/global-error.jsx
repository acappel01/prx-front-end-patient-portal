'use client';

import '@/public/scss/main.scss';

import ErrorState from '@/components/ui/ErrorState';

/**
 * The last boundary: the root layout itself failed, so this replaces it and
 * must render its own document. The deployment's brand comes from that layout
 * (lib/adminApi.js `deploymentConfig()`), which is what failed, so this page
 * page wears main.scss's neutral fallbacks: still the portal's type and
 * shapes, never Next's unstyled default page.
 */
export default function GlobalError({ error }) {
  return (
    <html lang="en" data-app="portal">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <title>Something went wrong</title>
      </head>
      <body>
        <div className="prx-app">
          <main className="prx-main">
            <ErrorState digest={error?.digest} onRetry={() => window.location.reload()} />
          </main>
        </div>
      </body>
    </html>
  );
}
