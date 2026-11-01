/**
 * A page the signed-in patient cannot reach (a conversation or visit id that
 * is not theirs, or does not exist — the admin does not say which). Inside the
 * portal layout, so the tabs stay.
 */
export default function PortalNotFound() {
  return (
    <>
      <h1>We can&rsquo;t find that page</h1>
      <p className="prx-muted">It may have moved, or it isn&rsquo;t available to this account.</p>
      <p>
        <a className="prx-task__cta" href="/">
          Go to your care
        </a>
      </p>
    </>
  );
}
