import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ethers } from 'ethers';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';
import Skeleton from '@/components/ui/Skeleton';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PaymentOptions from '@/components/contracts/PaymentOptions';
import { useToast } from '@/components/ui/Toast';
import PaymentTermsForm from '@/components/contracts/PaymentTermsForm';
import ReviewRequest from '@/components/contracts/ReviewRequest';
import CreateProgressSteps, { JourneyStep } from '@/components/contracts/CreateProgressSteps';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useTokenSelection } from '@/hooks/useTokenSelection';
import { useQrPayment } from '@/hooks/useQrPayment';
import { usePaymentSteps } from '@/hooks/usePaymentSteps';
import { isValidEmail, isValidWalletAddress, isValidDescription, addressesEqual, getDefaultTimestamp, formatDateTimeWithTZ } from '@/utils/validation';
import { getNetworkName } from '@/utils/networkUtils';
import { MIN_AMOUNT, TEST_AMOUNT, formatUsd, isAllowedAmount, parseAmount } from '@/utils/escrowFees';
import { callAp2Tool, isAp2ToolError } from '../lib/ap2Mcp';
import { decodePayResume, encodePayResume, withPayResume } from '../lib/payResume';
import { useT } from '../i18n';
import { useBrandedHref, usePartnerBrand } from '../theme';

/**
 * /pay — a buyer pushes a payment to a seller, into an escrow they can dispute.
 *
 * ⚠️ A THIN SKIN OVER ap2service'S MCP TOOLS, ON PURPOSE. prepare_escrow_payment decides the
 *    escrow address, the fee, the dispute window and the data the wallet signs; settle_escrow_
 *    payment relays the signature and creates the escrow. This page collects the terms, shows
 *    what prepare said, asks the wallet to sign, and shows what settle said. It is the same path
 *    an AI agent takes, so the site dogfoods the agent surface rather than bypassing it.
 *
 * The ways of paying are /contract-pay's, through the same PaymentOptions: the signed-in wallet
 * (adding funds first if it is short, or by card straight into the escrow), or any other wallet
 * by address or QR. The transfer routes are offered only when prepare put the escrow on file,
 * and "I have paid" — or the balance poll — settles through the same MCP tool, unsigned.
 */

const PUSH_JOURNEY_STEPS: JourneyStep[] = [
  { titleKey: 'push.step.details.title', detailKey: 'push.step.details.detail' },
  { titleKey: 'push.step.confirm.title', detailKey: 'push.step.confirm.detail' },
  { titleKey: 'push.step.done.title', detailKey: 'push.step.done.detail' },
];

interface Prepared {
  escrow_address: string;
  external_id: string;
  seller_receives_estimate: string;
  platform_fee_estimate: string;
  parties?: { seller?: { address: string } };
  fund_by_signature:
    | string
    | {
        typed_data?: {
          domain: Record<string, unknown>;
          types: Record<string, { name: string; type: string }[]>;
          message: Record<string, unknown>;
        };
        authorization?: Record<string, unknown>;
        payer_balance_base_units?: number;
        payer_can_cover?: boolean;
      };
  /** An object when the escrow is on file and may be funded directly; a reason when not. */
  fund_by_transfer: string | { payment_uri: string };
  dispute: { until?: string };
}

interface Settled {
  dispute?: { where?: string };
  /** The receipt's claims, beside the signed JWT. The JWT is authoritative; this is for acting on. */
  receipt_claims?: {
    'stabledrop.escrow'?: { contract_id?: string; escrow_account?: string; funding_tx_hash?: string };
  };
}

/** What a checkout needs to tell its merchant about a payment that has landed. */
export interface PaidEscrow {
  /** contractservice's id: what conduit-checkout.js verifies by, and what the Shopify order records. */
  contractId?: string;
  escrowAddress: string;
  /** The funding transfer. Absent when the money arrived by transfer before settle was called. */
  txHash?: string;
}

/**
 * /pay inside a merchant's checkout (/contract-create). The terms come from the merchant and are
 * not the buyer's to change, and what happens afterwards (postMessage, webhook, redirects) is the
 * checkout's business, so it is handed back through these.
 */
export interface PayCheckout {
  terms: { seller: string; amount: string; description: string; expiryTimestamp: number; tokenSymbol?: string };
  onPaid: (paid: PaidEscrow) => void;
  /** `prepare`: the payment could not be set up, and the buyer can try again here. `pay`: paying failed. */
  onFailed: (message: string, phase: 'prepare' | 'pay') => void;
  onCancel: () => void;
}

/** The receipt's escrow block as a checkout wants it. Accounts are CAIP-10; the address is the last part. */
export function paidEscrowFrom(settled: Settled | null, fallbackAddress: string): PaidEscrow {
  const escrow = settled?.receipt_claims?.['stabledrop.escrow'];
  return {
    contractId: escrow?.contract_id,
    escrowAddress: escrow?.escrow_account?.split(':').pop() || fallbackAddress,
    txHash: escrow?.funding_tx_hash,
  };
}

type Stage = 'details' | 'review' | 'done';

/** A prepare refusal that is about how much, and so belongs under the amount field. */
function isAmountRefusal(result: { error: string; message?: string }): boolean {
  return result.error === 'amount_too_small' || /^The minimum payment is/.test(result.message ?? '');
}

function firstSentence(message?: string): string | undefined {
  return message?.split(/(?<=\.)\s/)[0];
}

export default function PayPage({ checkout }: { checkout?: PayCheckout } = {}) {
  const t = useT();
  const router = useRouter();
  const { config } = useConfig();
  const { isLoading, isConnected, address, user, authenticatedFetch } = useAuth();
  const brandedHref = useBrandedHref();
  // The partner this payment is made under, recorded on the contract. Not a term: it moves no address.
  const brandId = usePartnerBrand()?.id;
  const attribution = brandId ? { brand: brandId } : {};
  const { getWeb3Service, getTokenBalance } = useSimpleEthers();
  const { showToast } = useToast();

  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>(checkout?.terms.tokenSymbol);
  const { selectedToken, selectedTokenSymbol, availableTokens } = useTokenSelection(config, tokenSymbol);
  const { tokenBalance, isLoadingBalance } = useTokenBalance({
    enabled: !!config?.rpcUrl,
    address,
    tokenAddress: selectedToken?.address,
    getTokenBalance,
  });

  const [seller, setSeller] = useState(checkout?.terms.seller ?? '');
  const [amount, setAmount] = useState(checkout?.terms.amount ?? '');
  const [payoutTimestamp, setPayoutTimestamp] = useState(checkout?.terms.expiryTimestamp ?? getDefaultTimestamp());
  const [description, setDescription] = useState(checkout?.terms.description ?? '');
  const [sellerError, setSellerError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();

  const [stage, setStage] = useState<Stage>('details');
  const [busy, setBusy] = useState<'prepare' | 'pay' | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [settled, setSettled] = useState<Settled | null>(null);
  /** The terms `prepared` was quoted for, to tell a real change from pressing Continue again. */
  const preparedFor = useRef<string | null>(null);

  const networkLabel = config ? getNetworkName(config.chainId) : undefined;
  const payer = user?.walletAddress || address;

  const { steps: paymentSteps, updateStep, setSteps } = usePaymentSteps([]);
  const signing = prepared && typeof prepared.fund_by_signature === 'object' ? prepared.fund_by_signature : null;
  const transferOffered = !!prepared && typeof prepared.fund_by_transfer === 'object';
  const amountInTokens = parseFloat(amount) || 0;
  const balanceFloat = parseFloat(tokenBalance) || 0;
  const baseUnits = (() => {
    try {
      return Number(ethers.parseUnits(amount.trim() || '0', selectedToken?.decimals ?? 6));
    } catch {
      return 0;
    }
  })();

  /** The terms, exactly as both tools take them: they ARE the escrow's address. */
  const terms = () => ({
    seller: seller.trim(),
    amount: baseUnits,
    expiry_timestamp: payoutTimestamp,
    nominal_buyer: payer,
    token_symbol: selectedTokenSymbol,
    description: description.trim(),
  });

  /** Why a checkout's payment could not be set up: its terms have no form to show an error on. */
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const fail = (message?: string) => {
    const said = message || t('wizard.genericError');
    showToast({ type: 'error', title: t('push.failed'), message: said });
    if (checkout) {
      setCheckoutError(said);
      checkout.onFailed(said, stage === 'review' ? 'pay' : 'prepare');
    }
  };

  /** A problem with one field: said under it on /pay, and as a failure in a checkout, where the merchant set it. */
  const fieldError = (set: (message: string | undefined) => void, message?: string) =>
    checkout ? fail(message) : set(message);

  /**
   * `externalId` when resuming: the same id gives the same escrow, and the same reservation.
   *
   * ⚠️ UNCHANGED TERMS KEEP THEIR ESCROW. Going back to the form and pressing Continue again
   *    used to mint a new id — a second escrow, a second reservation, another test-payment
   *    allowance used — and any address already shown for the first was now the wrong one. The
   *    id is new only when the terms actually changed.
   */
  const handlePrepare = async (resumeId?: string) => {
    const unchanged = prepared && preparedFor.current === JSON.stringify(terms());
    const externalId = resumeId ?? (unchanged ? prepared.external_id : undefined);
    const s = seller.trim();
    if (!isValidEmail(s) && !isValidWalletAddress(s)) {
      fieldError(setSellerError, t('push.errSeller'));
      return;
    }
    if (isValidWalletAddress(s) && payer && addressesEqual(s, payer)) {
      fieldError(setSellerError, t('validation.payToOwnWallet', { seller: s, buyer: payer }));
      return;
    }
    // The form limits what the buyer types; a merchant's link is checked here.
    if (checkout && !isValidDescription(description)) {
      fail(t('wizard.errDescription'));
      return;
    }
    setSellerError(undefined);
    // The site's own rule, the one the request form uses: $1 or more, or exactly the free test
    // amount. ap2service applies the same rule; checking here saves the round trip.
    const parsed = parseAmount(amount);
    if (parsed === null || !isAllowedAmount(parsed)) {
      fieldError(setAmountError, t('validation.amountRange', { min: formatUsd(MIN_AMOUNT), test: TEST_AMOUNT }));
      return;
    }
    setAmountError(undefined);
    setCheckoutError(null);
    setBusy('prepare');
    try {
      const result = await callAp2Tool<Prepared>('prepare_escrow_payment', {
        ...terms(),
        ...attribution,
        payer,
        ...(externalId ? { external_id: externalId } : {}),
      });
      if (isAp2ToolError(result)) {
        // An amount ap2service will not escrow (below its minimum, or its fee floor) is said
        // against the amount, and the buyer stays on the form: they never get an address to
        // pay into. Its first sentence is written for a person; the rest is for developers.
        if (isAmountRefusal(result)) return fieldError(setAmountError, firstSentence(result.message));
        return fail(result.message);
      }
      preparedFor.current = JSON.stringify(terms());
      setPrepared(result);
      setStage('review');
    } catch (error: any) {
      fail(error.message);
    } finally {
      setBusy(null);
    }
  };

  /** Paying from the signed-in wallet: it signs what prepare returned, and settle relays it. */
  const handleWalletPay = async () => {
    if (!prepared || !signing?.typed_data) return fail(t('push.cannotSign'));
    setBusy('pay');
    setSteps([
      { id: 'sign', label: t('push.signing'), status: 'active' },
      { id: 'settle', label: t('push.settling'), status: 'pending' },
    ]);
    try {
      const signer = await (await getWeb3Service()).getSigner();
      const { domain, types, message } = signing.typed_data;
      const signature = await signer.signTypedData(domain, types, message);

      updateStep('settle', 'active');
      const result = await callAp2Tool<Settled>('settle_escrow_payment', {
        ...terms(),
        ...attribution,
        external_id: prepared.external_id,
        authorization: signing.authorization,
        signature,
      });
      if (isAp2ToolError(result)) {
        updateStep('settle', 'error');
        return fail(result.message);
      }
      updateStep('settle', 'completed');
      setSettled(result);
      setStage('done');
    } catch (error: any) {
      fail(error.message);
    } finally {
      setBusy(null);
    }
  };

  /**
   * The transfer routes' sweep: settle with no signature, around what the address holds. Run by
   * useQrPayment behind its balance check, from "I have paid" or when the poll sees the money.
   */
  const settleTransfer = useCallback(async (): Promise<boolean> => {
    if (!prepared) return false;
    const result = await callAp2Tool<Settled>('settle_escrow_payment', {
      ...terms(),
      ...attribution,
      external_id: prepared.external_id,
    });
    if (isAp2ToolError(result)) {
      // The money may well be there — this ran because the balance check saw it. Say why settle
      // turned it down, rather than letting the panel read it as "no payment found".
      fail(result.message);
      return false;
    }
    setSettled(result);
    return true;
    // terms() reads the same state these name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, seller, baseUnits, payoutTimestamp, payer, selectedTokenSymbol, description, brandId]);

  const qr = useQrPayment({
    authenticatedFetch,
    getTokenBalance,
    selectedTokenAddress: selectedToken?.address,
    chainId: config?.chainId,
    requiredAmount: amountInTokens,
    requiredAmountMicro: baseUnits,
    // Already derived by prepare, and already on file: nothing to create.
    createContract: useCallback(async () => prepared?.escrow_address, [prepared]),
    onActivated: useCallback(() => setStage('done'), []),
    activation: { endpoint: 'settle_escrow_payment', run: settleTransfer },
    existingContractAddress: transferOffered ? prepared!.escrow_address : null,
  });

  /*
   * Resuming. A payment on the review screen lives in the URL as well as in memory, so coming
   * back from Coinbase on a phone, a refresh, or the Back button all land on it again. The URL
   * is refilled into the form first; prepare runs on the next render, once the form (and the
   * token it selects) actually holds those values.
   */
  const resumeParam = prepared
    ? encodePayResume({
        seller: seller.trim(),
        amount: amount.trim(),
        expiryTimestamp: payoutTimestamp,
        description: description.trim(),
        tokenSymbol: selectedTokenSymbol,
        externalId: prepared.external_id,
      })
    : null;
  const resumeHref = checkout
    ? withPayResume(router.asPath, resumeParam)
    : brandedHref(resumeParam ? `/pay?resume=${resumeParam}` : '/pay');

  const [resumingId, setResumingId] = useState<string | null>(null);
  const [resumingToken, setResumingToken] = useState<string | null>(null);
  const resumeRead = useRef(false);
  useEffect(() => {
    if (resumeRead.current || !router.isReady) return;
    resumeRead.current = true;
    const resume = decodePayResume(router.query.resume);
    if (!resume) return;
    setSeller(resume.seller);
    setAmount(resume.amount);
    setPayoutTimestamp(resume.expiryTimestamp);
    setDescription(resume.description);
    setTokenSymbol(resume.tokenSymbol);
    setResumingToken(resume.tokenSymbol);
    setResumingId(resume.externalId);
  }, [router.isReady, router.query.resume]);

  useEffect(() => {
    // Waits for the signed-in wallet (it is the payer and the disputer) and for the resumed
    // token to be the selected one, since the amount's base units depend on its decimals.
    if (!resumingId || !payer || !config || busy) return;
    if (resumingToken && selectedTokenSymbol.toUpperCase() !== resumingToken.toUpperCase()) return;
    const id = resumingId;
    setResumingId(null);
    void handlePrepare(id);
    // handlePrepare reads the refilled form from this same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumingId, payer, config, busy, selectedTokenSymbol, resumingToken]);

  // The address bar follows the screen: the payment's own link while it is being paid, plain
  // /pay once it is done, so a refresh never offers a finished payment again. Left alone on the
  // form, so a ?resume= link survives signing in before it has been picked up.
  //
  // ⚠️ NEVER IN A CHECKOUT. Its URL carries the merchant's return address and order id, and its
  //    path is what the layout recognises to drop our header and footer inside their page.
  useEffect(() => {
    if (checkout) return;
    if (!router.isReady || (stage === 'review' && !prepared) || stage === 'details') return;
    const want = stage === 'review' ? resumeHref : brandedHref('/pay');
    if (router.asPath !== want) void router.replace(want, undefined, { shallow: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, prepared, resumeHref, router.isReady]);

  /*
   * A checkout has no form to fill: its terms are the merchant's. Prepare runs once the payer is
   * signed in and the merchant's token is the selected one (the amount's base units depend on its
   * decimals) — unless a resume is about to, with the external id that keeps the same escrow.
   */
  const checkoutPrepared = useRef(false);
  useEffect(() => {
    if (!checkout || checkoutPrepared.current || !router.isReady) return;
    // The resume effect prepares this one, with its external id; a second, id-less prepare
    // would quote a different escrow.
    if (decodePayResume(router.query.resume)) {
      checkoutPrepared.current = true;
      return;
    }
    if (!payer || !config || busy || stage !== 'details') return;
    const wanted = checkout.terms.tokenSymbol;
    if (wanted && selectedTokenSymbol.toUpperCase() !== wanted.toUpperCase()) return;
    checkoutPrepared.current = true;
    void handlePrepare();
    // handlePrepare reads the checkout's terms from this same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, router.isReady, router.query.resume, payer, config, busy, stage, selectedTokenSymbol]);

  // Handed to the checkout once, when the escrow exists: the receipt says which one it is.
  const handedOff = useRef(false);
  useEffect(() => {
    if (!checkout || stage !== 'done' || handedOff.current || !prepared) return;
    handedOff.current = true;
    checkout.onPaid(paidEscrowFrom(settled, prepared.escrow_address));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, stage, settled, prepared]);

  // The receipt's link selects this payment on the dashboard. Its path and query only, so a
  // partner brand's site keeps its own domain rather than following the link to ours.
  const viewPayment = () => {
    const where = settled?.dispute?.where;
    if (!where) return router.push('/dashboard');
    const url = new URL(where, window.location.origin);
    router.push(`${url.pathname}${url.search}`);
  };

  const reset = () => {
    void router.replace(brandedHref('/pay'), undefined, { shallow: true });
    setSeller('');
    setAmount('');
    setDescription('');
    setPayoutTimestamp(getDefaultTimestamp());
    setPrepared(null);
    setSettled(null);
    setStage('details');
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-8 w-80 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // The same gate as /create: the payer signs from their own wallet, and holds the right to
  // dispute from the same account.
  if (!isConnected || !address) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <CreateProgressSteps current={0} steps={PUSH_JOURNEY_STEPS} />
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-secondary-900 dark:text-white tracking-tight">
            {t('push.title')}
          </h1>
          <p className="mt-3 text-secondary-500 dark:text-secondary-400">{t('push.signInBlurb')}</p>
        </div>
        <WalletChoiceCards />
        {checkout && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={checkout.onCancel}>{t('common.cancel')}</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="w-full max-w-2xl mx-auto px-4">
        <CreateProgressSteps
          current={stage === 'details' ? 0 : stage === 'review' ? 1 : 2}
          steps={PUSH_JOURNEY_STEPS}
        />

        {stage === 'details' && checkout && (
          <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 sm:p-8 text-center">
            {checkoutError ? (
              <>
                <p className="text-error-600 dark:text-error-400">{checkoutError}</p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => handlePrepare()} disabled={busy !== null}>{t('push.retry')}</Button>
                  <Button variant="outline" onClick={checkout.onCancel}>{t('common.cancel')}</Button>
                </div>
              </>
            ) : (
              <p className="text-secondary-600 dark:text-secondary-300">{t('push.checkoutPreparing')}</p>
            )}
          </div>
        )}

        {stage === 'details' && !checkout && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">{t('push.title')}</h2>
              <p className="mt-2 text-secondary-500 dark:text-secondary-400">{t('push.subtitle')}</p>
            </div>
            <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-5 sm:p-6 mb-6">
              <Input
                label={t('push.seller')}
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder={t('push.sellerPlaceholder')}
                helpText={t('push.sellerHelp')}
                error={sellerError}
                autoComplete="off"
              />
            </div>
            <PaymentTermsForm
              amount={amount}
              onAmountChange={(value) => {
                setAmount(value);
                setAmountError(undefined);
              }}
              payoutTimestamp={payoutTimestamp}
              onPayoutTimestampChange={setPayoutTimestamp}
              description={description}
              onDescriptionChange={setDescription}
              showFeeGuidance={false}
              amountLabels={{ requested: t('push.amountFiat'), receiving: t('push.amountToken') }}
              errors={{ amount: amountError }}
              tokenSymbol={selectedTokenSymbol}
              tokenOptions={availableTokens.map((token) => token.symbol)}
              onTokenChange={setTokenSymbol}
              networkLabel={networkLabel}
              balanceText={isLoadingBalance ? undefined : `Balance: ${tokenBalance} ${selectedTokenSymbol}`}
            />
            <div className="mt-8 flex justify-center">
              <Button
                onClick={() => handlePrepare()}
                disabled={!seller.trim() || !amount || !description.trim() || busy !== null}
                className="w-full sm:w-auto px-8"
              >
                {busy === 'prepare' ? t('push.checking') : t('push.continue')}
              </Button>
            </div>
          </>
        )}

        {stage === 'review' && prepared && (
          <>
            <ReviewRequest
              title={t('push.review')}
              amount={amount}
              tokenSymbol={selectedTokenSymbol}
              networkLabel={networkLabel}
              description={description}
              payoutTimestamp={payoutTimestamp}
              isInstantPayment={payoutTimestamp === 0}
              onEdit={checkout ? undefined : () => setStage('details')}
              extraRows={[
                { label: t('push.paying'), value: seller.trim() },
                { label: t('push.sellerReceives'), value: prepared.seller_receives_estimate },
                { label: t('push.fee'), value: prepared.platform_fee_estimate },
              ]}
              // PaymentOptions states what happens, once, over every way of paying.
              nextBody={null}
            />
            {/* No typed data means ap2service could not build the authorization (the token has
                no EIP-712 domain, or the chain was unreadable). Said, not left as a dead button;
                the transfer routes below still work. */}
            {!signing?.typed_data && (
              <p className="mt-5 text-sm text-error-600 dark:text-error-400 text-center">{t('push.cannotSign')}</p>
            )}
            <div className="mt-8">
              <PaymentOptions
                paymentSteps={paymentSteps}
                reassurance={t(payoutTimestamp === 0 ? 'pay.escrowInstant' : 'pay.escrowHeld', { amount: `${amount} ${selectedTokenSymbol}` })}
                amountLabel={`${amount} ${selectedTokenSymbol}`}
                amountInTokens={amountInTokens}
                balanceFloat={balanceFloat}
                tokenSymbol={selectedTokenSymbol}
                tokenAddress={selectedToken?.address ?? ''}
                tokenDecimals={selectedToken?.decimals ?? 6}
                chainId={config?.chainId}
                walletAddress={address}
                networkName={networkLabel ?? ''}
                isLoadingBalance={isLoadingBalance}
                hasInsufficientBalance={balanceFloat < amountInTokens}
                isSameAddress={false}
                isPaymentInProgress={busy === 'pay'}
                onPay={handleWalletPay}
                onPayFromExternalWallet={() => {
                  document.getElementById('pay-from-elsewhere')?.scrollIntoView({ behavior: 'smooth' });
                }}
                // Back onto this payment, not a blank form: after adding funds the wallet can now
                // pay; after a card payment the balance check finds the escrow funded and
                // settles it. (The escrow is on file either way, so a buyer who never comes back
                // still has a card payment completed by the sweep.)
                addFundsReturnPath={resumeHref}
                resolveEscrowAddress={transferOffered ? async () => prepared.escrow_address : undefined}
                elsewhere={
                  transferOffered
                    ? {
                        qr,
                        createButtonLabel: t('pay.payButton'),
                        createDisabled: false,
                        successMessage: t('push.doneTitle'),
                      }
                    : undefined
                }
              />
            </div>
            {checkout && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={checkout.onCancel} disabled={busy === 'pay'}>{t('common.cancel')}</Button>
              </div>
            )}
          </>
        )}

        {stage === 'done' && (
          <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 p-6 sm:p-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white">{t('push.doneTitle')}</h2>
            <p className="mt-3 text-secondary-600 dark:text-secondary-300">
              {payoutTimestamp === 0
                ? t('push.doneInstantBody', { amount, token: selectedTokenSymbol, seller: seller.trim() })
                : t('push.doneBody', {
                    amount,
                    token: selectedTokenSymbol,
                    seller: seller.trim(),
                    date: formatDateTimeWithTZ(payoutTimestamp),
                  })}
            </p>
            {/* A checkout takes the buyer back to the merchant from here. */}
            {!checkout && (
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={viewPayment} className="w-full sm:w-auto px-8">
                  {t('push.viewPayment')}
                </Button>
                <Button variant="outline" onClick={reset} className="w-full sm:w-auto px-8">
                  {t('push.another')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
