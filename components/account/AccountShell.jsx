import { deploymentConfig } from '@/lib/adminApi';
import { brandLogo, brandName } from '@/lib/theme';

/**
 * The frame for the signed-out account pages: sign in, register, forgot, and the
 * two emailed-link pages. The deployment's logo and name, never a compiled-in
 * brand. The logo comes from the admin's own host (Settings > Brand), not a
 * third party; without one, the name stands in.
 */
export default async function AccountShell({ children }) {
  const config = await deploymentConfig();
  const logo = brandLogo(config);
  const name = brandName(config);

  return (
    <div className="prx-app">
      <main className="prx-main">
        {/* One h1 either way; the pages under it start at h2. */}
        {logo ? (
          <h1 className="prx-account__brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-hosted, any format, no optimiser (next.config.mjs) */}
            <img src={logo.url} alt={logo.alt} className="prx-account__logo" />
          </h1>
        ) : (
          <h1>{name}</h1>
        )}
        {children}
      </main>
    </div>
  );
}
