import { apiFetch } from '@/lib/apiFetch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '@/components/auth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { buildWordPressStatusUrl as buildWpStatusUrl } from '@/utils/wordpressStatusUrl';
import { safeRedirectUrl } from '@/utils/safeRedirect';
import PayPage, { PaidEscrow, PayCheckout } from './PayPage';
import { useT } from '../i18n';
import { useBrandedHref, useOptionalBrand } from '../theme';
import { getSiteNameFromDomain } from '@/utils/siteName';

/**
 * /contract-create — a merchant's checkout: /pay with the merchant's terms, inside their page.
 *
 * ⚠️ THE PAYMENT IS /pay's. This page only translates. The URL parameters, postMessage events,
 *    webhook call, Shopify order and WordPress redirects in CONTRACT_CREATE_API.md are the
 *    contract with plugins already installed on merchants' sites, so they are kept exactly;
 *    everything between "the buyer is signed in" and "the escrow exists" is PayPage, the same
 *    path the site and AI agents use.
 *
 * ⚠️ THE PATH MATTERS. Layout drops our header and footer on /contract-create, which is what lets
 *    it sit inside a merchant's iframe or popup; PayPage never rewrites the URL in checkout mode.
 */

interface PostMessageEvent {
  type: 'contract_created' | 'payment_completed' | 'payment_cancelled' | 'payment_error' | 'close_modal';
  data?: any;
  error?: string;
}

const str = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/** `epoch_expiry`: 0 for instant, a future timestamp, or — missing or unusable — seven days out. */
function payoutFrom(epochExpiry: string | undefined): number {
  const fallback = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  if (epochExpiry === undefined) return fallback;
  const parsed = parseInt(epochExpiry, 10);
  if (!isNaN(parsed) && (parsed === 0 || parsed > Math.floor(Date.now() / 1000))) return parsed;
  console.warn('Invalid or past epoch_expiry provided:', epochExpiry);
  return fallback;
}

export default function ContractCreate() {
  const router = useRouter();
  const brandedHref = useBrandedHref();
  const seller = str(router.query.seller);
  const amount = str(router.query.amount);
  const description = str(router.query.description);
  const complete = !!(seller && amount && description);

  // No merchant terms, no checkout: someone arriving from a search result wants to pay someone.
  useEffect(() => {
    if (router.isReady && !complete) void router.replace(brandedHref('/pay'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, complete]);

  if (!router.isReady || !complete) return <CheckoutShell embedded={false} loading />;
  // A WordPress checkout that cannot tell the store it was paid is a plugin misconfiguration,
  // and taking the money anyway would leave an order nobody can reconcile.
  const q = router.query;
  if (str(q.wordpress_source) === 'true' && (!str(q.webhook_url) || !str(q.order_id))) {
    return (
      <CheckoutShell embedded={false}>
        <p className="max-w-md mx-auto p-6 text-center text-error-600 dark:text-error-400">
          Configuration error: this WordPress checkout link is missing its {!str(q.webhook_url) ? 'webhook URL' : 'order ID'}.
        </p>
      </CheckoutShell>
    );
  }
  return <Checkout seller={seller} amount={amount} description={description} />;
}

function CheckoutShell({ embedded, loading, children }: { embedded: boolean; loading?: boolean; children?: React.ReactNode }) {
  const t = useT();
  const brand = useOptionalBrand();
  // The tab title is the partner's too — a COBRO customer should not see our name in their browser chrome.
  const brandName = brand?.name ?? getSiteNameFromDomain();
  return (
    <div className={`min-h-screen transition-colors ${embedded ? 'bg-secondary-50 dark:bg-secondary-800' : 'bg-white dark:bg-secondary-900'}`}>
      <Head>
        <title>{t('checkout.docTitle', { brand: brandName })}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center text-center p-6">
          <div>
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-secondary-600 dark:text-secondary-300">{t('checkout.initializing')}</p>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function Checkout({ seller, amount, description }: { seller: string; amount: string; description: string }) {
  const router = useRouter();
  const { user, authenticatedFetch } = useAuth();
  const q = router.query;
  const returnUrl = str(q.return);
  const orderId = str(q.order_id);
  const wordpressSource = str(q.wordpress_source);
  const webhookUrl = str(q.webhook_url);
  const shop = str(q.shop);

  // Fixed once: a default payout recomputed on every render would be a different escrow each time.
  const [expiryTimestamp] = useState(() => payoutFrom(str(q.epoch_expiry)));

  const [isInIframe, setIsInIframe] = useState(false);
  const [isInPopup, setIsInPopup] = useState(false);
  useEffect(() => {
    setIsInIframe(window !== window.parent);
    setIsInPopup(window.opener !== null);
  }, []);

  // To the iframe's parent, or the popup's opener.
  const sendPostMessage = useCallback(
    (event: PostMessageEvent) => {
      if (isInIframe && window.parent) window.parent.postMessage(event, '*');
      if (isInPopup && window.opener) window.opener.postMessage(event, '*');
    },
    [isInIframe, isInPopup]
  );

  const statusUrl = useCallback(
    (status: 'completed' | 'cancelled' | 'error', extra: Record<string, string> = {}) =>
      buildWpStatusUrl(status, { returnUrl, orderId, wordpressSource }, extra),
    [returnUrl, orderId, wordpressSource]
  );

  const onPaid = useCallback(
    async (paid: PaidEscrow) => {
      const txHash = paid.txHash;

      // Webhook verification — only with a funding transaction to verify, as before: a transfer
      // that arrived before settle has none, and the merchant's plugin verifies the escrow itself.
      if (txHash && webhookUrl && authenticatedFetch) {
        try {
          const response = await authenticatedFetch('/api/payment/verify-and-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transaction_hash: txHash,
              contract_address: paid.escrowAddress,
              contract_hash: paid.escrowAddress,
              contract_id: paid.contractId,
              webhook_url: webhookUrl,
              order_id: parseInt(orderId || '0'),
              expected_amount: parseFloat(amount),
              expected_recipient: paid.escrowAddress,
              merchant_wallet: seller,
            }),
          });
          if (!response.ok) console.error('ContractCreate: Payment verification failed:', await response.text());
        } catch (error) {
          console.error('ContractCreate: Payment verification error:', error);
        }
      }

      if (shop) {
        try {
          await apiFetch('/api/shopify/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shop,
              orderId,
              contractId: paid.contractId,
              productId: str(q.product_id),
              variantId: str(q.variant_id),
              title: str(q.title) || description,
              price: amount,
              quantity: parseInt(str(q.quantity) || '1'),
              buyerEmail: user?.email || str(q.email),
              transactionHash: txHash,
            }),
          });
        } catch (error) {
          console.error('ContractCreate: Failed to create Shopify order:', error);
        }
      }

      // contract_created used to precede funding; the escrow now exists only once it is funded,
      // so both are sent here, in their old order.
      sendPostMessage({
        type: 'contract_created',
        data: { contract_id: paid.contractId, amount, description, seller, orderId },
      });
      sendPostMessage({
        type: 'payment_completed',
        data: {
          contractId: paid.contractId,
          amount,
          description,
          seller,
          orderId,
          transactionHash: txHash,
          contractAddress: paid.escrowAddress,
        },
      });

      setTimeout(() => {
        if (isInIframe) {
          sendPostMessage({ type: 'close_modal' });
        } else if (isInPopup) {
          window.close();
        } else if (returnUrl) {
          window.location.href = safeRedirectUrl(
            statusUrl('completed', {
              contract_id: paid.contractId || '',
              contract_hash: paid.escrowAddress,
              tx_hash: txHash || '',
            })
          );
        } else {
          router.push('/dashboard');
        }
      }, 2000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authenticatedFetch, user?.email, sendPostMessage, statusUrl, isInIframe, isInPopup]
  );

  const onFailed = useCallback(
    (message: string, phase: 'prepare' | 'pay') => {
      sendPostMessage({ type: 'payment_error', error: message });
      // Setting up failed: the buyer can try again here, as they could before.
      if (phase === 'prepare') return;
      if (wordpressSource === 'true' && returnUrl) {
        const errorUrl = safeRedirectUrl(statusUrl('error', { error: encodeURIComponent(message) }));
        if (isInPopup && window.opener) {
          window.opener.location.href = errorUrl;
          window.close();
        } else if (!isInIframe) {
          window.location.href = errorUrl;
        }
      } else if (isInPopup) {
        setTimeout(() => window.close(), 2000);
      }
    },
    [sendPostMessage, wordpressSource, returnUrl, statusUrl, isInIframe, isInPopup]
  );

  const onCancel = useCallback(() => {
    sendPostMessage({ type: 'payment_cancelled' });
    if (isInIframe) {
      sendPostMessage({ type: 'close_modal' });
    } else if (isInPopup) {
      // WordPress wants its cancelled status page; the SDK shows its own message in the parent.
      if (window.opener && wordpressSource === 'true' && returnUrl) {
        window.opener.location.href = safeRedirectUrl(statusUrl('cancelled'));
      }
      window.close();
    } else if (returnUrl) {
      window.location.href = safeRedirectUrl(statusUrl('cancelled'));
    } else {
      router.push('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendPostMessage, isInIframe, isInPopup, wordpressSource, returnUrl, statusUrl]);

  const checkout = useMemo<PayCheckout>(
    () => ({
      terms: { seller, amount, description, expiryTimestamp, tokenSymbol: str(q.tokenSymbol) },
      onPaid,
      onFailed,
      onCancel,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seller, amount, description, expiryTimestamp, q.tokenSymbol, onPaid, onFailed, onCancel]
  );

  return (
    <CheckoutShell embedded={isInIframe || isInPopup}>
      <PayPage checkout={checkout} />
    </CheckoutShell>
  );
}
