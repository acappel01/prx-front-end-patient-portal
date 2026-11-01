'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

import ErrorState from '@/components/ui/ErrorState';

/**
 * The authenticated shell's error boundary. Renders inside the portal layout,
 * so the brand bar and tabs stay and the patient can go anywhere else.
 * "Try again" refetches the server render, then re-renders this segment.
 */
export default function PortalError({ error, reset }) {
  const router = useRouter();

  return (
    <ErrorState
      digest={error?.digest}
      onRetry={() =>
        startTransition(() => {
          router.refresh();
          reset();
        })
      }
    />
  );
}
