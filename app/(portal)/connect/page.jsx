import RequestClaimLink from '@/components/account/RequestClaimLink';

export const dynamic = 'force-dynamic';

/**
 * Connect a medical record to this account.
 *
 * Reached from Home when `linked` is false. The patient proves the order is
 * theirs by receiving an email at the address it was placed under — there is no
 * order reference to type, and no `?order=` to carry, because an order uuid is
 * not proof of anything.
 */
export default function ConnectPage() {
  return (
    <>
      <h1>Connect your record</h1>
      <p className="prx-muted prx-lede">
        Your consultation created a medical record. Connect it once and your care, prescriptions
        and results appear here.
      </p>
      <p className="prx-muted prx-lede">
        We will email a link to the address you used when you ordered.
      </p>
      <RequestClaimLink />
      <p className="prx-muted prx-connect__help">
        If you have just finished a consultation it can take a few minutes before a link can be
        sent.
      </p>
    </>
  );
}
