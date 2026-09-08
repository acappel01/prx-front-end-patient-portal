import { redirect } from 'next/navigation';

import LoginForm from '@/components/ui/LoginForm';
import { deploymentConfig } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await sessionToken()) redirect('/');

  const config = await deploymentConfig();

  return (
    <div className="prx-app">
      <main className="prx-main">
        {/* The deployment's name, never a compiled-in brand. */}
        <h1>{config?.brand?.name ?? 'Patient portal'}</h1>
        <LoginForm />
      </main>
    </div>
  );
}
