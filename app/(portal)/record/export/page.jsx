import ExportPanel from '@/components/record/ExportPanel';
import BackLink from '@/components/ui/BackLink';

export const dynamic = 'force-dynamic';

/** Record → A copy of your record: the patient's right of access. */
export default function ExportPage() {
  return (
    <>
      <BackLink />
      <h1>A copy of your record</h1>
      <ExportPanel />
    </>
  );
}
