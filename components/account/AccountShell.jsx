import { deploymentConfig } from '@/lib/adminApi';

/**
 * The frame for the signed-out account pages: sign in, register, forgot, and the
 * two emailed-link pages. The deployment's name, never a compiled-in brand.
 */
export default async function AccountShell({ children }) {
  const config = await deploymentConfig();

  return (
    <div className="prx-app">
      <main className="prx-main">
        <h1>{config?.brand?.name ?? 'Patient portal'}</h1>
        {children}
      </main>
    </div>
  );
}
