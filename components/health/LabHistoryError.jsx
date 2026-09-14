import Reference from '@/components/ui/Reference';
import SignOutButton from '@/components/ui/SignOutButton';
import { LABS_PATH } from '@/lib/labHistory.mjs';

export default function LabHistoryError({ result }) {
  if (result.state === 'unlinked') return <p>Connect your medical record to see lab orders. <a href="/connect">Connect your record</a>.</p>;
  if (result.state === 'signed-out') return <p>Sign in again to access your lab orders. <a href="/login">Sign in</a>.</p>;
  if (result.state === 'forbidden') return <><p>Your session does not have access to lab orders. Sign out, then sign in again.</p><SignOutButton /></>;
  if (result.state === 'invalid') return <p>That page is not available. <a href={LABS_PATH}>Go to the first page</a>.</p>;
  return (
    <div role="status">
      <p>{result.state === 'limited' ? 'Please wait a moment before loading your lab orders again.' : 'We can’t load your lab orders right now. Please try again in a moment.'}</p>
      {result.status >= 500 ? <Reference id={result.requestId} /> : null}
    </div>
  );
}
