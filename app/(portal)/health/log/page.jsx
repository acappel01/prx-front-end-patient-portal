import VitalsForm from '@/components/health/VitalsForm';

export const dynamic = 'force-dynamic';

/**
 * Log a reading — the destination of Health's empty state and of its list
 * action.
 *
 * A server component wrapping one client leaf, so the page itself carries no
 * interaction and the form carries no data fetch. Everything the form needs it
 * already knows; the only thing it sends is what the patient typed.
 */
export default function LogVitalPage() {
  return (
    <>
      <h1>Log a reading</h1>
      {/* The lede belongs to the FORM, not the page: once the form has been
          replaced by an outcome, an instruction on how to fill it in is
          standing above a message that says it is already gone. */}
      <VitalsForm />
    </>
  );
}
