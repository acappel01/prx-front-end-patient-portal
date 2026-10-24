/** "← Your record" above a sub-screen's heading. */
export default function BackLink({ href = '/record', label = 'Your record' }) {
  return (
    <p className="prx-back">
      <a href={href}>← {label}</a>
    </p>
  );
}
