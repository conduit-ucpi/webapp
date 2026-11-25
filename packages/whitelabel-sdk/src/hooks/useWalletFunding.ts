import { useEffect, useState } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/SimpleAuthProvider';
import { ONRAMP_RETURN_MESSAGE, openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { reportFundingEvent } from '@/lib/reportFundingEvent';
import { reportOnrampStatus } from '@/lib/reportOnrampStatus';
import { krakenDelivers, krakenPurchaseAmount, krakenRampUrl } from '@/lib/krakenRamp';
import { linkDelivers, linkOnrampUrl } from '@/lib/stripeLinkOnramp';
import { detectUserCurrency } from '@/utils/currencyDetection';
import { useT } from '../i18n';

/**
 * Coinbase enforces a minimum purchase, so presetting a smaller amount bounces. Expressed in
 * tokens because that is what is asked for, and USDC tracks the dollar closely enough for the floor.
 */
export const ONRAMP_MIN_CRYPTO = 5;

export interface WalletFundingRequest {
  /** The connected wallet: where every route here delivers. */
  walletAddress: string;
  tokenSymbol: string;
  /** For naming a token the wallet provider's on-ramp does not know. */
  tokenAddress?: string;
  chainId?: number;
  /** How much is to be bought, in whole tokens. */
  shortfall: number;
  /** The exchange's current minimum in tokens, when known. Otherwise ONRAMP_MIN_CRYPTO applies. */
  minimumPurchase?: number;
  /** Where Coinbase should return the user. Defaults to the page they left. */
  returnPath?: string;
  /** Which way into Coinbase this was, for the log. */
  purpose?: 'add-funds' | 'guide';
  /** A route reported the money as sent, or Coinbase's window came back. */
  onFunded?: () => void;
}

/**
 * The routes that buy a token INTO THE CONNECTED WALLET, for whoever lists them: the "add funds"
 * list (FundingOptions) and the pay screen's "Card or bank" choices (PaymentActionPanel). One
 * place, so the two cannot drift on how much is asked for or what is copied where.
 *
 * Not the routes that pay a payment's contract address directly: those are the panel's own.
 */
export function useWalletFunding({
  walletAddress,
  tokenSymbol,
  tokenAddress,
  chainId: givenChainId,
  shortfall,
  minimumPurchase = ONRAMP_MIN_CRYPTO,
  returnPath,
  purpose = 'add-funds',
  onFunded,
}: WalletFundingRequest) {
  const t = useT();
  const { config } = useConfig();
  const chainId = givenChainId ?? config?.chainId;
  // The wallet provider's own on-ramp (Privy's funding window). Absent for Reown, so the
  // guard is on capability, not on provider name.
  const { canFundWallet, fundWallet } = useAuth();
  const canUseCard = typeof canFundWallet === 'function' && canFundWallet();
  const [error, setError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  /** The last card purchase came back unconfirmed: it may still deliver, so say not to buy again. */
  const [cardProcessing, setCardProcessing] = useState(false);
  const [coinbaseBusy, setCoinbaseBusy] = useState(false);

  // The desktop popup posts back here when Coinbase is done. The holder re-reads the balance -
  // otherwise the user comes back to a screen still telling them they are short.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== ONRAMP_RETURN_MESSAGE) return;
      setCoinbaseBusy(false);
      onFunded?.();
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFunded]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard can be blocked; the value is on screen to copy by hand.
      return false;
    }
  };

  /** Tokens asked of the card and Coinbase routes: the shortfall to the cent, or the minimum. */
  const asked = Math.max(Math.ceil(shortfall * 100) / 100, minimumPurchase);

  const startCard = async () => {
    setError(null);
    setCardBusy(true);
    // Same rounding as the Coinbase route: ask for tokens, rounded up to the cent, so a
    // >= balance gate cannot fail on dust.
    const amount = asked.toFixed(2);
    const logged = { wallet: walletAddress, amount, provider: 'Privy', route: 'wallet' as const };
    void reportFundingEvent('privy-started', logged);
    try {
      const result = await fundWallet({
        amount,
        asset: tokenSymbol === 'USDC' || !tokenAddress ? 'USDC' : { erc20: tokenAddress, symbol: tokenSymbol },
        chainId: chainId ?? 0,
      });
      const status = result?.status;
      void reportFundingEvent(
        status === 'completed' ? 'privy-completed' : status === 'processing' ? 'privy-processing' : 'privy-cancelled',
        { ...logged, detail: result?.detail }
      );
      // Processing is not funded: the balance is re-read when the buyer comes back to the page.
      if (status === 'processing') setCardProcessing(true);
      if (status === 'completed') {
        setCardProcessing(false);
        onFunded?.();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : t('addFunds.couldNotOpenFunding');
      void reportFundingEvent('privy-failed', { ...logged, detail: message });
      setError(message);
    } finally {
      setCardBusy(false);
    }
  };

  const startCoinbase = async () => {
    setError(null);
    setCoinbaseBusy(true);
    try {
      void reportFundingEvent('coinbase-opened', { wallet: walletAddress, amount: asked.toFixed(2), provider: 'Coinbase', route: 'wallet' });
      await openCoinbaseOnramp({
        destinationAddress: walletAddress,
        purpose,
        asset: tokenSymbol,
        // Ask for the tokens needed, not the dollars spent. Coinbase's fee comes
        // out of a fiat amount, so presetting fiat delivered a few percent less
        // USDC than the shortfall - and the payment's activation gate is a
        // >= check on the token balance, which then never passes.
        // Rounded up to the cent so the gate cannot fail on dust.
        presetCryptoAmount: asked,
        returnPath,
        onPopupClosed: () => {
          void reportFundingEvent('coinbase-closed', { wallet: walletAddress, amount: asked.toFixed(2), provider: 'Coinbase', route: 'wallet' });
          void reportOnrampStatus('closed');
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('addFunds.couldNotOpenCoinbase'));
    } finally {
      setCoinbaseBusy(false);
    }
  };

  // Kraken's purchase page, for what it has been seen to deliver (lib/krakenRamp).
  const startKraken = () => {
    const amount = krakenPurchaseAmount(shortfall);
    const url = krakenRampUrl({ walletAddress, tokenSymbol, chainId, amount, fiatCurrency: detectUserCurrency() });
    if (!url) return;
    void reportFundingEvent('kraken-opened', { wallet: walletAddress, amount: String(amount), provider: 'Kraken', route: 'wallet' });
    // Kraken drops the address we send and asks for one after sign-in (lib/krakenRamp). Copied
    // before the tab opens: a page that is not in front cannot write to the clipboard.
    void copy(walletAddress);
    // A new tab: Kraken has no way back here that we know of, and the payment waits in this one.
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Stripe's Link page (lib/stripeLinkOnramp). It takes no wallet address, so the address is
  // copied for the buyer to paste there, and shown to check against.
  const startLink = () => {
    const amount = Math.ceil(shortfall * 100) / 100;
    const url = linkOnrampUrl({ tokenSymbol, chainId, amount });
    if (!url) return;
    void reportFundingEvent('link-opened', { wallet: walletAddress, amount: String(amount), provider: 'Link', route: 'wallet' });
    void copy(walletAddress);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return {
    chainId,
    /** What the card and Coinbase routes ask for, in whole tokens. */
    asked,
    error,
    copy,
    card: { available: canUseCard, busy: cardBusy, processing: cardProcessing, start: startCard },
    coinbase: { busy: coinbaseBusy, start: startCoinbase },
    kraken: { delivers: krakenDelivers(tokenSymbol, chainId), start: startKraken },
    link: { delivers: linkDelivers(tokenSymbol, chainId), start: startLink },
  };
}
