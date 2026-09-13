import AccountShell from '@/components/account/AccountShell';
import EmailLinkForm from '@/components/account/EmailLinkForm';

export const dynamic = 'force-dynamic';

/**
 * Create an account — by email, not by form.
 *
 * There is no name or password here on purpose. An account is only created by
 * the link we email, for the address it was sent to, so nobody can register a
 * stranger's address. An address that already has an account is sent a
 * password-reset link instead; the screen says the same thing either way.
 */
export default function RegisterPage() {
  return (
    <AccountShell>
      <h2>Create your account</h2>
      <p className="prx-muted prx-lede">
        Enter the email address you used for your order. We will email you a link to set up your account.
      </p>
      <EmailLinkForm intent="register" submitLabel="Email me a link" />
      <p>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </AccountShell>
  );
}
