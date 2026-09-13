import AccountShell from '@/components/account/AccountShell';
import EmailLinkForm from '@/components/account/EmailLinkForm';

export const dynamic = 'force-dynamic';

/**
 * Forgot password. Same request as registering: an address with an account gets
 * a reset link, and an address with an order but no account yet gets a
 * create-account link — so this is also a working front door for someone who
 * never set one up.
 */
export default function ForgotPage() {
  return (
    <AccountShell>
      <h2>Reset your password</h2>
      <p className="prx-muted prx-lede">Enter your email address and we will send you a link to set a new password.</p>
      <EmailLinkForm intent="forgot" submitLabel="Email me a link" />
      <p>
        <a href="/login">Back to sign in</a>
      </p>
    </AccountShell>
  );
}
