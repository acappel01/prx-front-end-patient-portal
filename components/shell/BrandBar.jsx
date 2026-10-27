import Link from 'next/link';

import { brandLogo, brandName } from '@/lib/theme';

/**
 * The brand across the top of every signed-in screen: the admin's logo (or the
 * brand name without one), linking home. The same logo and width as the
 * signed-out pages and the website header (Settings > Brand, Settings > Theme >
 * Logo size), so a patient can tell whose portal this is on every screen.
 *
 * Not a heading: each screen has its own h1.
 */
export default function BrandBar({ config }) {
  const logo = brandLogo(config);
  const name = brandName(config);

  return (
    <header className="prx-brandbar">
      <Link href="/" className="prx-brandbar__home" aria-label={`${name}, home`}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-hosted, any format, no optimiser (next.config.mjs)
          <img src={logo.url} alt="" className="prx-brandbar__logo" />
        ) : (
          <span className="prx-brandbar__name">{name}</span>
        )}
      </Link>
    </header>
  );
}
