import Link from 'next/link';
import AccountShell from '@/components/account/AccountShell';

/**
 * An address that does not exist, outside the signed-in shell. Branded through
 * AccountShell, like the sign-in pages.
 */
export default function NotFound() {
  return (
    <AccountShell>
      <h2>We can&rsquo;t find that page</h2>
      <p className="prx-muted">Check the address, or start from the beginning.</p>
      <p>
        <Link className="prx-task__cta" href="/">
          Go to your care
        </Link>
      </p>
    </AccountShell>
  );
}
