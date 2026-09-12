import ClaimRecordForm from '@/components/account/ClaimRecordForm';
import LoginForm from '@/components/ui/LoginForm';
import { adminFetch, deploymentConfig } from '@/lib/adminApi';
import { sessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

// The URL of this page is a credential. Belt and braces with the
// `Referrer-Policy: no-referrer` header next.config.mjs sets for this path.
export const metadata = { referrer: 'no-referrer' };

/** The exact shape the admin mints: 32 random bytes, base64url, 43 characters. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Where an emailed claim link lands.
 *
 * OUTSIDE the authenticated `(portal)` tree on purpose. That layout redirects a
 * visitor with no session to /login, which would drop the token on the floor —
 * or tempt someone into carrying it in a `?next=` and copying a credential into
 * a second URL. Instead this page asks for a sign-in in place and re-renders.
 *
 * RENDERING THIS PAGE CHANGES NOTHING. A mail scanner that fetches the link sees
 * a button. Only the POST behind the button spends the token.
 */
export default async function ClaimPage({ params }) {
  const { token } = await params;
  const config = await deploymentConfig();
  const brand = config?.brand?.name ?? 'Patient portal';

  if (!TOKEN.test(token ?? '')) {
    return (
      <Shell brand={brand}>
        <p>This link is not valid. Links from the email work once and expire after an hour.</p>
        <p>
          <a href="/connect">Request a new link</a>
        </p>
      </Shell>
    );
  }

  if (!(await sessionToken())) {
    return (
      <Shell brand={brand}>
        <h2>Connect your record</h2>
        <p className="prx-muted prx-lede">
          Sign in to the account you created, then connect your record from this page.
        </p>
        <LoginForm stayOnPage />
      </Shell>
    );
  }

  // Only to avoid offering a button that can only fail. The admin re-checks
  // everything on the POST; this read decides nothing.
  const me = await adminFetch('/patient/auth/me');

  if (me.status === 401) {
    return (
      <Shell brand={brand}>
        <h2>Connect your record</h2>
        <p className="prx-muted prx-lede">Your session has ended. Sign in again to continue.</p>
        <LoginForm stayOnPage />
      </Shell>
    );
  }

  if (me.data?.has_prx_chart) {
    return (
      <Shell brand={brand}>
        <h2>Your record is already connected</h2>
        <p>
          <a className="prx-task__cta" href="/">
            Go to your care
          </a>
        </p>
      </Shell>
    );
  }

  return (
    <Shell brand={brand}>
      <h2>Connect your record</h2>
      <p className="prx-muted prx-lede">
        This connects the record from your order to the account you are signed in to
        {me.data?.email ? ` (${me.data.email})` : ''}.
      </p>
      <ClaimRecordForm token={token} />
    </Shell>
  );
}

function Shell({ brand, children }) {
  return (
    <div className="prx-app">
      <main className="prx-main">
        {/* The deployment's name, never a compiled-in brand. */}
        <h1>{brand}</h1>
        {children}
      </main>
    </div>
  );
}
