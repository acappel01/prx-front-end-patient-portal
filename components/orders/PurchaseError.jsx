import Reference from '@/components/ui/Reference';
import SignOutButton from '@/components/ui/SignOutButton';
import { PURCHASES_PATH } from '@/lib/commerceHistory.mjs';

export default function PurchaseError({ result, detail = false }) {
  if (result.state === 'forbidden') {
    return <><p className="prx-muted">Your session does not have access to these orders. Sign out, then sign in again.</p><SignOutButton /></>;
  }
  if (result.state === 'signed-out') {
    return <p className="prx-muted">Sign in again to access your orders. <a href="/login">Sign in</a>.</p>;
  }
  if (result.state === 'not-found' && detail) {
    return <p className="prx-muted">This order is not available for your account. <a href={PURCHASES_PATH}>View your orders</a>.</p>;
  }
  if (result.state === 'invalid') {
    return <p className="prx-muted">That page is not available. <a href={PURCHASES_PATH}>Go to the first page</a>.</p>;
  }
  return (
    <div role="status">
      <p className="prx-muted">{result.state === 'limited'
        ? 'Please wait a moment before loading your orders again.'
        : 'We can’t load your orders right now. Please try again in a moment.'}</p>
      {result.status >= 500 ? <Reference id={result.requestId} /> : null}
    </div>
  );
}
