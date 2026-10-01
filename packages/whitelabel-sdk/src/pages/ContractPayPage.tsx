import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ethers } from 'ethers';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PaymentRequestIntro from '@/components/contracts/PaymentRequestIntro';
import CustomArbiterNotice from '@/components/contracts/CustomArbiterNotice';
import { usePayableContract } from '@/hooks/usePayableContract';
import type { PendingContract } from '@/types';
import { getSiteNameFromDomain } from '@/utils/siteName';
import PayPage, { type PayRequest } from './PayPage';
import { useT } from '../i18n';
import { useOptionalBrand, useContractBrand } from '../theme/BrandProvider';

/**
 * /contract-pay?contractId= — pay a request someone made on /create.
 *
 * ⚠️ A THIN WRAPPER OVER /pay, as /contract-create is. PayPage does the paying, through
 *    ap2service: the request's prepare makes the signed-in wallet its buyer and quotes the escrow
 *    (the same address this page always derived, so links already sent still pay where they
 *    did), and settle creates it. This page only finds the request, says when it cannot be paid,
 *    and hands its terms over.
 */

/**
 * AppKit's AUTH (embedded wallet) connector rehydrates through an auth iframe. Until that
 * round-trip finishes, isConnected is false while authLoading is true — and on a flaky
 * connection it may never finish. Give up after this and render the signed-out screens instead.
 */
const AUTH_REHYDRATE_TIMEOUT_MS = 5000;

/** contractservice's stand-ins for "no email": not something to show a payer. */
const PLACEHOLDER_EMAIL = /^(createdempty@conduit-ucpi\.com|noemail@notsupplied\.com|noemail@notprovided\.com|no-email@placeholder\.com)$/i;

/** The request's terms as PayPage takes them, or null while the token is not yet known. */
function requestFrom(contract: PendingContract, decimals: number | undefined): PayRequest | null {
  if (decimals === undefined) return null;
  const baseUnits = Math.round(contract.amount);
  const whole = ethers.formatUnits(BigInt(baseUnits), decimals).replace(/\.0$/, '');
  return {
    id: contract.id,
    terms: {
      seller: contract.sellerAddress,
      amount: whole,
      amountBaseUnits: baseUnits,
      description: contract.description,
      expiryTimestamp: contract.expiryTimestamp,
      tokenSymbol: contract.currencySymbol || 'USDC',
      ...(contract.arbiterAddress ? { arbiter: contract.arbiterAddress } : {}),
    },
    sellerLabel:
      contract.sellerEmail && !PLACEHOLDER_EMAIL.test(contract.sellerEmail) ? contract.sellerEmail : undefined,
    notice: <CustomArbiterNotice arbiterAddress={contract.arbiterAddress} />,
  };
}

export default function ContractPay() {
  const t = useT();
  const router = useRouter();
  const { contractId } = router.query;
  const { config } = useConfig();
  const { authenticatedFetch, isLoading: authLoading, isConnected, address } = useAuth();
  const brand = useOptionalBrand();
  const pageTitle = t('pay.docTitle', { brand: brand?.name ?? getSiteNameFromDomain() });

  const [introDismissed, setIntroDismissed] = useState(false);
  const [authWaitElapsed, setAuthWaitElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAuthWaitElapsed(true), AUTH_REHYDRATE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  // Read once the payer is signed in: a request is only readable to a session.
  const { contract, isLoadingContract, contractError } = usePayableContract({
    contractId,
    isConnected,
    address,
    authenticatedFetch,
  });
  // The payer sees the partner the request was made under, even from a link that lost its ?b=.
  useContractBrand(contract?.brandId);

  const signedIn = isConnected || !!address;
  // Coming back from the onramp: the wallet reconnects a moment after the session does.
  const returning = router.query.resuming === '1' || router.query.method === 'qr';

  const screen = (body: React.ReactNode) => (
    <div className="min-h-screen bg-white dark:bg-secondary-900 transition-colors">
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {body}
    </div>
  );

  const message = (title: string, detail: string) =>
    screen(
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-red-600 mb-4">{title}</h2>
          <p className="text-secondary-600 dark:text-secondary-300 mb-6">{detail}</p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">{t('common.goToDashboard')}</Button>
        </div>
      </div>
    );

  if ((authLoading || returning) && !signedIn && !authWaitElapsed) {
    return screen(
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-secondary-600 dark:text-secondary-300">{t('pay.loading')}</p>
        </div>
      </div>
    );
  }

  if (router.isReady && !contractId) return message(t('pay.invalidLink'), t('pay.noId'));

  // A signed-out buyer arriving from a link or QR: what this is, before being asked to sign in.
  // Nothing about the request is shown, because nothing is readable until they have.
  if (!signedIn && !introDismissed) {
    return screen(
      <div className="min-h-screen flex items-center justify-center">
        <PaymentRequestIntro onContinue={() => setIntroDismissed(true)} />
      </div>
    );
  }

  // PayPage asks a signed-out payer to sign in, the way /pay always does.
  if (!signedIn) return screen(<PayPage />);

  // ⚠️ SAID, NOT "NOT FOUND". An expired request used to be reported as missing, which sent its
  //    buyer looking for a link that was fine.
  if (contractError && /expired/i.test(contractError)) {
    return message(t('pay.expiredTitle'), t('pay.expiredDetail'));
  }
  if (!contract && !isLoadingContract) return message(t('pay.notFound'), t('pay.notFoundDetail'));

  const token = config?.supportedTokens?.find(
    (candidate: { symbol: string }) =>
      candidate.symbol.toUpperCase() === (contract?.currencySymbol || 'USDC').toUpperCase()
  );
  const request = contract ? requestFrom(contract, token?.decimals) : null;
  if (!request) {
    return screen(
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Keyed by the request, so a different one in the same tab starts from nothing.
  return screen(<PayPage key={request.id} request={request} />);
}
