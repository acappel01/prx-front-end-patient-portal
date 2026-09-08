import ConnectRecordForm from '@/components/account/ConnectRecordForm';

export const dynamic = 'force-dynamic';

/**
 * Connect a medical record to this account.
 *
 * Reached from Home when `linked` is false, and directly by a link carrying
 * `?order=` — which is how a patient should normally arrive, since the
 * reference is a uuid nobody is going to type from memory.
 */
export default async function ConnectPage({ searchParams }) {
  const params = await searchParams;
  const order = typeof params?.order === 'string' ? params.order : '';

  return (
    <>
      <h1>Connect your record</h1>
      <p className="prx-muted prx-lede">
        Your consultation created a medical record. Connect it once and your care, prescriptions
        and results appear here.
      </p>
      <ConnectRecordForm initialReference={order} />
      <p className="prx-muted prx-connect__help">
        The order reference is in your confirmation email. If you have just finished a consultation
        it can take a few minutes to become available.
      </p>
    </>
  );
}
