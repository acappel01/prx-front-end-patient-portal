/**
 * "Reference: 1f3c…" under an error a patient may need to report.
 *
 * Only for failures the patient cannot fix themselves (a 5xx, the provider not
 * answering). The id is the admin's correlation id — an opaque uuid, not PHI —
 * which support can find in the admin's logs and, for provider failures, the
 * provider's. Rendered small and selectable; nothing else about the failure is.
 */
export default function Reference({ id }) {
  if (!id) return null;

  return (
    <p className="prx-reference prx-muted">
      Reference: <span className="prx-reference__id">{id}</span>
    </p>
  );
}
