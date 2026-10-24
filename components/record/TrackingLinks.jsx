/**
 * Tracking for one shipment: a link per parcel, or the number when the
 * carrier gave no link. The admin keeps http(s) links only.
 */
export default function TrackingLinks({ tracking }) {
  if (!tracking || tracking.length === 0) return null;

  return (
    <ul className="prx-order__tracking">
      {tracking.map((parcel, index) => (
        <li key={parcel.number ?? parcel.url ?? index}>
          {parcel.url ? (
            <a href={parcel.url} target="_blank" rel="noopener noreferrer">
              {tracking.length > 1 ? `Track parcel ${index + 1}` : 'Track your parcel'}
            </a>
          ) : (
            <span className="prx-row__meta">Tracking number {parcel.number}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
