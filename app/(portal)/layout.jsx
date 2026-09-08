import { redirect } from 'next/navigation';

import TabBar from '@/components/shell/TabBar';
import { deploymentConfig } from '@/lib/adminApi';
import { destinationsFor } from '@/lib/destinations';
import { sessionToken } from '@/lib/session';

/**
 * Authenticated shell. Every route under it requires a session.
 *
 * The check is here rather than in middleware on purpose: middleware runs on
 * the edge without access to the signature secret in every deployment shape,
 * and a route that authenticates in two places eventually authenticates in
 * neither. One gate, at the layout that owns the authenticated tree.
 */
export default async function PortalLayout({ children }) {
  if (!(await sessionToken())) {
    redirect('/login');
  }

  const config = await deploymentConfig();

  return (
    <div className="prx-app">
      <main className="prx-main">{children}</main>
      <TabBar destinations={destinationsFor(config)} />
    </div>
  );
}
