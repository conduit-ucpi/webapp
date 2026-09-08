import { useEffect, useState } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { getNetworkName } from '@/utils/networkUtils';
import { useQrPayment } from '@/hooks/useQrPayment';
import { useMarketplaceActions } from '@/hooks/useMarketplaceActions';
import Button from '@/components/ui/Button';
import PaymentActionPanel from '@/components/contracts/PaymentActionPanel';
import QrPaymentPanel from '@/components/contracts/QrPaymentPanel';

interface OfferFundingPanelProps {
  /** The deployed vault. It exists and is PENDING; this panel is only about getting money in. */
  vaultAddress: string;
  /** The escrow's own token — the ONLY token this vault will recognise. */
  tokenAddress: string;
  /** Base units (the vault compares this against its own balance). */
  offerAmount: string;
  lpAddress: string;
  onFunded: () => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Getting an LP's capital into their offer vault — the same three routes, and the same
 * machinery, as funding an escrow (§15.6d).
 *
 * ⚠️ THIS IS THE ESCROW'S DIRECT-PAYMENT FLOW, NOT A PARALLEL ONE. Both fund an address by
 *    plain ERC20 transfer and then have the platform relay a permissionless call that
 *    observes the balance — `checkAndActivate` for an escrow, `fund()` for a vault. So the
 *    LP gets what a buyer gets: pay from the connected wallet, top that wallet up first, or
 *    send from an external wallet via link/QR with an "I have paid" button.
 *
 *    Reusing `useQrPayment` rather than reimplementing it is what carries over the part
 *    that is easy to omit: it reads the destination's balance BEFORE asking chainservice to
 *    send anything, because both relayed calls revert when the money has not arrived and
 *    burn gas doing it.
 *
 * ⚠️ THE VAULT MUST ALREADY EXIST. Unlike the escrow pages, there is no "create it first"
 *    step here — `createOffer` ran before this panel mounted, because the LP needs an
 *    address to send to. `useQrPayment`'s create step is therefore pre-resolved.
 */
export default function OfferFundingPanel({
  vaultAddress,
  tokenAddress,
  offerAmount,
  lpAddress,
  onFunded,
  onCancel,
}: OfferFundingPanelProps) {
  const { config } = useConfig();
  const { getTokenBalance } = useSimpleEthers();
  const { authenticatedFetch } = useAuth();
  const { fundOffer } = useMarketplaceActions();

  const [route, setRoute] = useState<'wallet' | 'external'>('wallet');
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isFunding, setIsFunding] = useState(false);
  // ⚠️ The transfer and the open fail independently. Once the LP's money has left their
  //    wallet, the ONLY safe retry is opening the existing deposit — paying again would put
  //    a second offer's worth of capital into a vault that owes back one.
  const [deposited, setDeposited] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const networkName = config ? getNetworkName(config.chainId) : 'Unknown Network';
  const tokenSymbol = config?.tokenSymbol || 'USDC';
  const decimals = config?.defaultToken?.decimals ?? 6;
  const amountInTokens = Number(offerAmount) / 10 ** decimals;

  // The vault is already deployed, so the QR controller's "create" step is a no-op that
  // simply hands back the address the LP must send to.
  const qr = useQrPayment({
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress: tokenAddress,
    chainId: config?.chainId,
    requiredAmount: amountInTokens,
    requiredAmountMicro: Number(offerAmount),
    createContract: async () => vaultAddress,
    onActivated: () => {
      void onFunded();
    },
    // fund() in place of checkAndActivate: same shape, different contract.
    activation: {
      endpoint: '/api/chain/marketplace/fund-offer',
      buildBody: (address) => ({ vaultAddress: address }),
    },
  });

  // The LP's own balance decides which wallet action is live, exactly as it does for a buyer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const value = await getTokenBalance(lpAddress, tokenAddress);
        if (!cancelled) setBalance(parseFloat(value));
      } catch (e) {
        console.error('OfferFundingPanel: could not read the LP balance:', e);
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setIsLoadingBalance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // getTokenBalance is intentionally omitted: useSimpleEthers returns a fresh object each
    // render, so including it would re-poll on every render. See useQrPayment for the same note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpAddress, tokenAddress]);

  const balanceFloat = balance ?? 0;
  const hasInsufficientBalance = balance !== null && balanceFloat < amountInTokens;

  const payFromConnectedWallet = async () => {
    setError(null);
    setIsFunding(true);
    setLoadingMessage(`Sending ${tokenSymbol} to your offer vault…`);
    try {
      await fundOffer(vaultAddress, tokenAddress, offerAmount, () => {
        setDeposited(true);
        setLoadingMessage('Deposit received. Opening your offer…');
        // Resolve the QR controller's destination even on the wallet route: if the open
        // below fails, the recovery button drives it, and checkAndActivate is a no-op until
        // this address is set.
        void qr.createContract();
      });
      await onFunded();
    } catch (e: any) {
      setError(e?.message || 'The deposit did not go through.');
    } finally {
      setIsFunding(false);
      setLoadingMessage('');
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/*
        The deposit landed but the offer did not open. Recovery is the open ALONE — routed
        through the QR controller's activation, which re-reads the vault balance before
        spending gas and is the same call the "I have paid" button makes.
      */}
      {deposited && !isFunding ? (
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
            <div className="font-medium">Your {tokenSymbol} is in your offer vault.</div>
            <p className="mt-1">
              Opening the offer did not complete, so the seller cannot see it yet. Your capital
              is safe and still yours — this only needs another attempt. Do not send again.
            </p>
          </div>
          <Button type="button" className="w-full" onClick={() => void qr.checkAndActivate()}>
            {qr.qrActivationStatus === 'checking' ? 'Opening…' : 'Open my offer'}
          </Button>
          {qr.qrActivationStatus === 'waiting' && (
            <p className="text-xs text-secondary-500 dark:text-secondary-400">
              Not open yet. If your transfer is still confirming, wait a moment and try again.
            </p>
          )}
        </div>
      ) : route === 'wallet' ? (
        <PaymentActionPanel
          amountLabel={`${amountInTokens.toFixed(2)} ${tokenSymbol}`}
          amountInTokens={amountInTokens}
          balanceFloat={balanceFloat}
          tokenSymbol={tokenSymbol}
          tokenAddress={tokenAddress}
          tokenDecimals={decimals}
          chainId={config?.chainId}
          walletAddress={lpAddress}
          networkName={networkName}
          isLoadingBalance={isLoadingBalance}
          hasInsufficientBalance={hasInsufficientBalance}
          // An LP bidding on their own position is blocked by the factory, not here.
          isSameAddress={false}
          isPaymentInProgress={isFunding}
          loadingMessage={loadingMessage}
          onPay={payFromConnectedWallet}
          onPayFromExternalWallet={() => {
            setRoute('external');
            // Resolve the destination immediately so the link and QR render at once —
            // the vault already exists, so there is nothing to wait for.
            void qr.createContract();
          }}
        />
      ) : (
        <QrPaymentPanel
          qr={qr}
          networkName={networkName}
          tokenSymbol={tokenSymbol}
          amountInTokens={amountInTokens}
          isMobileDevice={typeof navigator !== 'undefined' && /iPhone|iPad|Android/i.test(navigator.userAgent)}
          copiedAddress={copiedAddress}
          onCopyAddress={copyAddress}
          createButtonLabel="Show the payment link"
          createDisabled={false}
          onCancel={onCancel}
          successMessage="Your offer is funded and live. The seller can now accept it."
        />
      )}
    </div>
  );
}
