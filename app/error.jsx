'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

import ErrorState from '@/components/ui/ErrorState';

/**
 * The error boundary for the signed-out pages (sign in, account links, claim).
 * Inside the root layout, so the deployment's theme and fonts still apply.
 */
export default function AppError({ error, reset }) {
  const router = useRouter();

  return (
    <div className="prx-app">
      <main className="prx-main">
        <ErrorState
          digest={error?.digest}
          onRetry={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        />
      </main>
    </div>
  );
}
