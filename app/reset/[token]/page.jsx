import AccountShell from '@/components/account/AccountShell';
import SetPasswordForm from '@/components/account/SetPasswordForm';

export const dynamic = 'force-dynamic';

// The URL of this page is a credential. Belt and braces with the
// `Referrer-Policy: no-referrer` header next.config.mjs sets for this path.
export const metadata = { referrer: 'no-referrer' };

/** The exact shape the admin mints: 32 random bytes, base64url, 43 characters. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Where an emailed reset link lands.
 *
 * OUTSIDE the authenticated `(portal)` tree: there is no session yet, and that
 * layout would redirect to /login and drop the token. No session is needed, so
 * none of the Strict-cookie reload the claim page does applies here.
 *
 * RENDERING THIS PAGE CHANGES NOTHING, and it asks the admin nothing — not even
 * whether the link is still good, which would be a lookup any mail scanner
 * could trigger. Only submitting the form spends the token.
 */
export default async function ResetPage({ params }) {
  const { token } = await params;

  if (!TOKEN.test(token ?? '')) {
    return (
      <AccountShell>
        <p>This link is not valid. Links from the email work once and expire after an hour.</p>
        <p>
          <a href="/forgot">Email me a new link</a>
        </p>
      </AccountShell>
    );
  }

  return (
    <AccountShell>
      <h2>Set a new password</h2>
      <p className="prx-muted prx-lede">Choose a new password. You will be signed out on every other device.</p>
      <SetPasswordForm token={token} mode="reset" />
    </AccountShell>
  );
}
