'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The five destinations. Client-side only because it needs the active path —
 * nothing else here is interactive, and no data passes through it.
 *
 * `destinations` comes from the deployment configuration, not from this file:
 * a group not using labs should not ship an empty Health tab, and which tabs
 * exist is a setting rather than a fork.
 *
 * The centre item is raised and is the consult path. It is one tap from every
 * screen because in the portal this replaces it was a submenu item behind a
 * hamburger — the highest-value action in the product, two taps and a scroll
 * away.
 */
export default function TabBar({ destinations }) {
  const pathname = usePathname();

  return (
    <nav className="prx-tabbar" aria-label="Primary">
      {destinations.map((destination) => {
        const active =
          destination.href === '/'
            ? pathname === '/'
            : pathname.startsWith(destination.href);

        return (
          <Link
            key={destination.href}
            href={destination.href}
            className={`prx-tab${destination.raised ? ' prx-tab--raised' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="prx-tab__glyph" aria-hidden="true">
              {destination.glyph}
            </span>
            <span>{destination.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
