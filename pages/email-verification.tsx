import { useState } from 'react';
import { useAuth } from '@/components/auth';
import { useWallet } from '@/lib/auth/react/hooks/useWallet';
import Button from '@/components/ui/Button';
import ConnectWalletEmbedded from '@/components/auth/ConnectWalletEmbedded';
import Skeleton from '@/components/ui/Skeleton';
import { emailVerificationPageGate } from '@/utils/featureFlags';

type Stage = 'enter' | 'signing' | 'sent' | 'unsent';

/**
 * Bind an email address to the connected wallet.
 *
 * The wallet is already proven by the session, so the signature collected here
 * is not a second login — it is the artifact a third party can check without
 * trusting us. It is collected in the app, where the wallet already is, and the
 * email goes out only afterwards.
 */
export default function EmailVerificationPage() {
  const { isLoading, isConnected, address, user } = useAuth();
  const { signMessage } = useWallet();

  const [stage, setStage] = useState<Stage>('enter');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const wallet = user?.walletAddress || address || '';

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/email-verification/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start verification');

      // A live verification that has already been signed is waiting on the
      // mailbox, not on the wallet. Signing its message again goes nowhere:
      // the server only ever looks for one that is still awaiting a signature.
      //
      // Signed does not mean sent. A send that failed leaves the row signed with
      // nothing delivered, and telling someone to check an inbox that will never
      // receive anything is worse than the error it replaced.
      if (data.status && data.status !== 'awaiting_signature') {
        setStage(data.emailSent ? 'sent' : 'unsent');
        return;
      }

      setStage('signing');

      // Sign the string exactly as returned. Any trimming or re-encoding here
      // recovers a different address, which reads as a mismatched signer.
      const signature = await signMessage(data.message);

      const signRes = await fetch('/api/email-verification/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || 'Could not verify the signature');

      setMaskedEmail(signData.email || '');
      setStage('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setStage('enter');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/email-verification/resend', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend');
      setResent(true);
      setMaskedEmail(data.email || maskedEmail);
      setStage('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-semibold mb-4 text-secondary-900 dark:text-white">
          Verify an email address
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400 mb-6">
          Connect your wallet to link an email address to it.
        </p>
        <ConnectWalletEmbedded />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold mb-2 text-secondary-900 dark:text-white">
        Verify an email address
      </h1>
      <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-8">
        Linking to wallet <span className="font-mono">{wallet}</span>
      </p>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {stage === 'enter' && (
        <div className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 text-secondary-900 dark:text-white"
          />
          <p className="text-sm text-secondary-500 dark:text-secondary-400">
            You will sign a short message with your wallet, then confirm from your inbox.
            Signing moves no funds.
          </p>
          <Button onClick={start} disabled={busy || !email.trim()}>
            {busy ? 'Working…' : 'Continue'}
          </Button>
        </div>
      )}

      {stage === 'signing' && (
        <div className="space-y-3">
          <p className="text-secondary-900 dark:text-white">Check your wallet.</p>
          <p className="text-sm text-secondary-600 dark:text-secondary-400">
            Approve the signature request to confirm you control this wallet.
          </p>
        </div>
      )}

      {stage === 'unsent' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-secondary-900 dark:text-white">
            We couldn&apos;t send the email
          </h2>
          <p className="text-secondary-600 dark:text-secondary-400">
            Your wallet signature went through, but the email didn&apos;t get out. Nothing
            is lost — try sending it again.
          </p>
          <Button onClick={resend} disabled={busy}>
            {busy ? 'Sending…' : 'Try again'}
          </Button>
        </div>
      )}

      {stage === 'sent' && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-secondary-900 dark:text-white">
            Check your email
          </h2>
          <p className="text-secondary-600 dark:text-secondary-400">
            We sent a confirmation link to {maskedEmail || 'your address'}. Open it to
            finish linking this email to your wallet.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={resend} disabled={busy}>
              {busy ? 'Sending…' : resent ? 'Send again' : 'Resend email'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Behind the EMAIL_VERIFICATION_LIVE release flag: 404s unless the flag is on.
export const getServerSideProps = emailVerificationPageGate;
