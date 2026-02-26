import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';

interface WalletRegistrationPrereqProps {
  /** Context-specific description shown before the steps, e.g. "Before deploying the payment integration, you must register your settlement wallet address:" */
  description?: string;
  /** Context-specific instruction for step 2, e.g. "Return here to complete Shopify theme integration" */
  returnInstruction?: string;
  /** Where to navigate after successful registration. Defaults to '/dashboard' */
  redirectAfterAuth?: string;
}

export default function WalletRegistrationPrereq({
  description = 'Before proceeding, you must register your settlement wallet address:',
  returnInstruction = 'Return here to continue setup',
  redirectAfterAuth = '/dashboard',
}: WalletRegistrationPrereqProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { user, connect } = useAuth();

  const currencyList = config?.supportedTokens?.length
    ? config.supportedTokens.map(t => t.symbol).join('/')
    : config?.tokenSymbol || 'USDC';

  const handleRegister = async () => {
    if (connect) {
      const result = await connect('walletconnect');
      if (result?.success) {
        router.push(redirectAfterAuth);
      }
    }
  };

  return (
    <section className="bg-yellow-50 border-2 border-yellow-400 p-4 sm:p-5 rounded-lg my-4 sm:my-5" aria-label="Required wallet configuration">
      <h2 className="text-yellow-800 m-0 mb-3 text-lg sm:text-xl font-bold">Prerequisites: Wallet Registration</h2>
      <p className="text-yellow-800 mb-3 text-sm sm:text-base">
        {description}
      </p>
      <ol className="text-yellow-800 pl-5 mb-3 space-y-1 text-sm sm:text-base">
        <li>
          Sign in to register your wallet:{' '}
          {user ? (
            <span className="inline-block mt-2 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-bold">Registered</span>
          ) : (
            <button
              onClick={handleRegister}
              className="inline-block mt-2 bg-primary-500 text-white py-2 px-4 rounded-md text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer border-none"
            >
              Register My Wallet
            </button>
          )}
        </li>
        <li>{returnInstruction}</li>
      </ol>
      <p className="text-yellow-800 text-xs sm:text-sm mb-0">
        One-time setup. Your wallet address establishes the settlement endpoint for all {currencyList} transactions.
      </p>
    </section>
  );
}
