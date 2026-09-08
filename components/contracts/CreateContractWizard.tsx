import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ethers } from 'ethers';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import PaymentQRModal from '@/components/ui/PaymentQRModal';
import { Wizard, WizardStep, WizardNavigation, WizardStep as Step } from '@/components/ui/Wizard';
import {
  isValidEmail,
  isValidDescription,
  isValidAmount,
  isValidBuyerIdentifier,
  isValidWalletAddress,
  toMicroUSDC,
  formatUSDC,
  formatDateTimeWithTZ,
  getDefaultTimestamp
} from '@/utils/validation';
import {
  MIN_AMOUNT,
  TEST_AMOUNT,
  formatUsd,
  isAllowedAmount,
  parseAmount,
} from '@/utils/escrowFees';
import ReleaseDateField from '@/components/contracts/ReleaseDateField';
import AdvancedOptions from '@/components/contracts/AdvancedOptions';
import PaymentTermsForm from '@/components/contracts/PaymentTermsForm';
import CreateProgressSteps from '@/components/contracts/CreateProgressSteps';
import ReviewRequest from '@/components/contracts/ReviewRequest';
import SendRequestScreen from '@/components/contracts/SendRequestScreen';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { getNetworkName } from '@/utils/networkUtils';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import { emailsEqual } from '@/utils/address';

interface CreateContractForm {
  buyerEmail: string;
  buyerType: 'email' | 'farcaster';
  buyerFid?: number;
  amount: string;
  payoutTimestamp: number;
  description: string;
  arbiterAddress: string;
}

interface FormErrors {
  buyerEmail?: string;
  amount?: string;
  expiry?: string;
  description?: string;
  arbiterAddress?: string;
}

// Amount, timing and description now share one screen ("Request a Payment"),
// matching the Connect / Payment Terms / Complete & Send journey.
const steps: Step[] = [
  {
    id: 'payment',
    title: 'Payment Terms',
    description: 'Amount, timing and description'
  },
  {
    id: 'review',
    title: 'Review & Send',
    description: 'Confirm details'
  }
];

export default function CreateContractWizard() {
  const router = useRouter();
  const { config } = useConfig();
  const { user, authenticatedFetch, refreshUserData, isConnected, address } = useAuth();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttemptedUserFetch, setHasAttemptedUserFetch] = useState(false);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
    buyerType: 'email',
    buyerFid: undefined,
    amount: '',
    payoutTimestamp: getDefaultTimestamp(),
    description: '',
    arbiterAddress: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showQRModal, setShowQRModal] = useState(false);
  const [isInstantPayment, setIsInstantPayment] = useState(false);
  // The buyer is no longer identified by email on the create screen - the
  // request is delivered by share link instead - so this defaults on. The
  // existing gates then skip buyer-email validation and the submit path
  // already handles the no-email case.
  const [noBuyerEmail, setNoBuyerEmail] = useState(true);
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>(
    config?.defaultTokenSymbol || config?.tokenSymbol || 'USDC'
  );

  // Determine available tokens based on config
  const availableTokens = config?.supportedTokens && config.supportedTokens.length > 0
    ? config.supportedTokens.filter(t => t.enabled !== false)
    : (config?.usdcDetails || config?.usdcContractAddress
        ? [config.usdcDetails || { symbol: 'USDC', address: config.usdcContractAddress }]
        : []);

  // Token balance (read-only), shown on the Request a Payment screen. Same
  // pattern as contract-create/contract-pay - the hook itself also requires
  // address + tokenAddress before it fetches.
  const { getTokenBalance } = useSimpleEthers();
  const selectedTokenAddress = availableTokens.find(t => t.symbol === selectedTokenSymbol)?.address;
  const { tokenBalance, isLoadingBalance } = useTokenBalance({
    enabled: !!config?.rpcUrl,
    address,
    tokenAddress: selectedTokenAddress,
    getTokenBalance,
  });

  // Fetch user data when wallet connects (lazy auth will trigger automatically if needed)
  useEffect(() => {
    const fetchUserData = async () => {
      // Only fetch once per session
      if (hasAttemptedUserFetch) {
        return;
      }

      // Only fetch if wallet is connected
      if (!isConnected && !address) {
        return;
      }

      // If we already have user data, no need to fetch
      if (user) {
        return;
      }

      console.log('🔧 CreateContractWizard: Fetching user data (lazy auth will trigger if needed)');
      setHasAttemptedUserFetch(true);

      try {
        // This will trigger lazy auth automatically if no session exists
        await refreshUserData?.();
        console.log('🔧 CreateContractWizard: User data loaded successfully');
      } catch (error) {
        // If it fails, that's OK - we'll proceed without user data
        console.log('🔧 CreateContractWizard: Could not load user data, proceeding without it');
      }
    };

    fetchUserData();
    // NOTE: refreshUserData is intentionally NOT a dependency — recreated on
    // every auth step, so including it re-fires this effect mid-auth and drives
    // a re-render/re-auth storm. The hasAttemptedUserFetch/isConnected/address/
    // user guards make this a one-shot fetch. See contract-pay.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, user, hasAttemptedUserFetch]);

  // Generate payment URL for in-person QR code
  const generatePaymentUrl = (): string => {
    if (!user || !config) return '';

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      seller: user.walletAddress || '',
      amount: form.amount,
      description: form.description,
      epoch_expiry: form.payoutTimestamp.toString(),
      tokenSymbol: selectedTokenSymbol
    });

    return `${baseUrl}/contract-create?${params.toString()}`;
  };

  // Generate payment link for created contract
  const generateContractPaymentLink = (): string => {
    if (!createdContractId) return '';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/contract-pay?contractId=${createdContractId}`;
  };

  // Copy to clipboard. `kind` only affects wording — the send screen decides
  // whether that's the bare link or the full message.
  const handleCopyPaymentLink = async (
    text?: string,
    kind: 'link' | 'message' = 'link'
  ) => {
    const payload = text ?? generateContractPaymentLink();
    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 3000);
      showToast({
        type: 'success',
        title: kind === 'message' ? 'Message copied!' : 'Link copied!',
        message:
          kind === 'message'
            ? 'Paste it to your buyer — it includes the link and what the payment is for'
            : 'Payment link copied to clipboard'
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      showToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Could not copy to clipboard'
      });
    }
  };

  // Handle in-person QR code generation
  const handleGenerateQR = () => {
    if (!validateStep(0)) {
      return;
    }
    setShowQRModal(true);
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};
    
    switch (step) {
      case 0: // Basic Details
        // Use SDK utils if available, otherwise fall back to local validation
        const descriptionValidator = isValidDescription;

        // Only validate buyer email if NOT instant payment AND NOT noBuyerEmail (email not needed for QR payments or manual notification)
        if (!isInstantPayment && !noBuyerEmail) {
          // Validate buyer identifier (email or Farcaster handle)
          const buyerValidation = isValidBuyerIdentifier(form.buyerEmail);
          if (!buyerValidation.isValid) {
            newErrors.buyerEmail = buyerValidation.error || 'Invalid buyer identifier';
          } else {
            // Check if buyer and seller are the same person
            const buyerIdentifier = form.buyerEmail.trim();

            // Check if buyer email matches seller email (case-insensitive)
            if (user?.email && emailsEqual(buyerIdentifier, user.email)) {
              newErrors.buyerEmail = `You cannot create a payment request to yourself. The buyer email (${buyerIdentifier}) matches your account email (${user.email}).`;
            }

            // Check if buyer looks like a wallet address and matches seller wallet (case-insensitive)
            if (user?.walletAddress && isValidWalletAddress(buyerIdentifier)) {
              if (buyerIdentifier.toLowerCase() === user.walletAddress.toLowerCase()) {
                newErrors.buyerEmail = `You cannot create a payment request to yourself. The buyer wallet address matches your connected wallet.`;
              }
            }
          }
        }

        if (!descriptionValidator(form.description)) {
          newErrors.description = 'Description must be 1-160 characters';
        }

        // Validate optional arbiter wallet address (advanced field)
        // If blank/whitespace-only: skip — this is an optional override.
        // If provided: must be a valid Ethereum address.
        {
          const trimmedArbiter = form.arbiterAddress.trim();
          if (trimmedArbiter.length > 0 && !isValidWalletAddress(trimmedArbiter)) {
            newErrors.arbiterAddress = 'Invalid arbiter wallet address';
          }
        }
        // Falls through: amount and timing are on this same screen now.
        
        // Use SDK utils if available, otherwise fall back to local validation
        const amountValidator = isValidAmount;

        if (!amountValidator(form.amount)) {
          newErrors.amount = 'Please enter a valid amount';
        } else {
          // isValidAmount only checks "> 0". The contract also enforces a
          // floor, with the test amount as the sole exemption — without this
          // the guidance under the field would state a rule the form ignores.
          const parsedAmount = parseAmount(form.amount);
          if (parsedAmount !== null && !isAllowedAmount(parsedAmount)) {
            newErrors.amount = `Enter ${formatUsd(MIN_AMOUNT)} or more, or exactly ${TEST_AMOUNT} for a free test`;
          }
        }

        // Only validate timestamp if not instant payment
        if (!isInstantPayment) {
          const now = Math.floor(Date.now() / 1000);
          const oneYearFromNow = now + (365 * 24 * 60 * 60);

          if (!form.payoutTimestamp || form.payoutTimestamp <= 0) {
            newErrors.expiry = 'Please select a valid date and time';
          } else if (form.payoutTimestamp <= now) {
            newErrors.expiry = 'Payout time must be in the future';
          } else if (form.payoutTimestamp > oneYearFromNow) {
            newErrors.expiry = 'Payout time must be within 1 year';
          }
        }
        break;
        
      case 1: // Review - everything was validated on the form screen
        return validateStep(0);
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // Clear errors when going back
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(2) || !config || !user) return;

    setIsLoading(true);
    
    try {
      if (availableTokens.length === 0) {
        throw new Error('No tokens configured');
      }

      const selectedToken = availableTokens.find(t => t.symbol === selectedTokenSymbol);
      if (!selectedToken?.address) {
        throw new Error(`Token ${selectedTokenSymbol} address not configured`);
      }

      if (!user.walletAddress) {
        throw new Error('User wallet address not available. Please try logging in again.');
      }
      
      const pendingContractRequest = {
        buyerEmail: noBuyerEmail
          ? 'createdempty@conduit-ucpi.com'
          : (form.buyerType === 'email' ? form.buyerEmail : (form.buyerFid ? `${form.buyerFid}@farcaster.xyz` : '')),
        buyerFarcasterHandle: form.buyerType === 'farcaster' ? form.buyerEmail : '',
        sellerEmail: user.email,
        sellerAddress: user.walletAddress,
        amount: toMicroUSDC(parseFloat(form.amount.trim())),
        currency: `micro${selectedTokenSymbol}`,
        currencySymbol: selectedTokenSymbol,
        description: form.description,
        expiryTimestamp: form.payoutTimestamp,
        serviceLink: config.serviceLink,
        ...(form.arbiterAddress.trim() ? { arbiterAddress: ethers.getAddress(form.arbiterAddress.trim()) } : {})
      };

      if (!authenticatedFetch) {
        throw new Error('Not authenticated');
      }
      const response = await authenticatedFetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingContractRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contract');
      }

      const responseData = await response.json();
      const contractId = responseData.contractId || responseData.id;

      setCreatedContractId(contractId);
      setShowSuccessScreen(true);

      showToast({
        type: 'success',
        title: 'Payment request created!',
        message: isInstantPayment
          ? 'QR code ready!'
          : noBuyerEmail
            ? 'Payment link ready to share!'
            : `${form.buyerEmail} will receive an email notification.`
      });
    } catch (error: any) {
      console.error('Contract creation failed:', error);
      showToast({
        type: 'error',
        title: 'Failed to create payment request',
        message: error.message || 'An error occurred. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step content renderers
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <WizardStep children={
            <>
              <h2 className="text-2xl sm:text-3xl font-semibold text-secondary-900 dark:text-white mb-6 text-center">
                Request a Payment
              </h2>
              <PaymentTermsForm
                amount={form.amount}
                onAmountChange={(amount) => setForm(prev => ({ ...prev, amount }))}
                payoutTimestamp={form.payoutTimestamp}
                onPayoutTimestampChange={(payoutTimestamp) => setForm(prev => ({ ...prev, payoutTimestamp }))}
                description={form.description}
                onDescriptionChange={(description) => setForm(prev => ({ ...prev, description }))}
                arbiterAddress={form.arbiterAddress}
                onArbiterChange={(arbiterAddress) => setForm(prev => ({ ...prev, arbiterAddress }))}
                errors={errors}
                tokenSymbol={selectedTokenSymbol}
                tokenOptions={availableTokens.map(t => t.symbol)}
                onTokenChange={setSelectedTokenSymbol}
                networkLabel={config ? getNetworkName(config.chainId) : undefined}
                balanceText={isLoadingBalance ? undefined : `Balance: ${tokenBalance} ${selectedTokenSymbol}`}
              />
            </>
          } />
        );


      case 1:
        return (
          <WizardStep children={
            <ReviewRequest
              amount={form.amount}
              tokenSymbol={selectedTokenSymbol}
              networkLabel={config ? getNetworkName(config.chainId) : undefined}
              description={form.description}
              payoutTimestamp={form.payoutTimestamp}
              isInstantPayment={isInstantPayment}
              onEdit={() => { setCurrentStep(0); setErrors({}); }}
            />
          } />
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    let result: any;
    switch (currentStep) {
      case 0:
        // One screen now: description, amount and (unless instant) a payout time.
        result =
          !!form.description &&
          !!form.amount &&
          (isInstantPayment || form.payoutTimestamp > 0) &&
          (isInstantPayment || noBuyerEmail ? true : !!form.buyerEmail);
        break;
      case 1:
        result = user && user.walletAddress; // Only allow final submission when user is authenticated
        break;
      default:
        result = false;
    }
    console.log('🔧 canProceed', {
      step: currentStep,
      result: !!result,
      isInstantPayment,
      noBuyerEmail,
      hasBuyerEmail: !!form.buyerEmail,
      hasDescription: !!form.description,
      hasAmount: !!form.amount,
      payoutTimestamp: form.payoutTimestamp,
      hasUser: !!user,
      hasWallet: !!user?.walletAddress,
      isLoading,
    });
    return result;
  };

  // Show success screen after contract creation
  if (showSuccessScreen && createdContractId) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <CreateProgressSteps current={2} />

        <SendRequestScreen
          paymentLink={generateContractPaymentLink()}
          amount={form.amount}
          tokenSymbol={selectedTokenSymbol}
          networkLabel={config ? getNetworkName(config.chainId) : undefined}
          description={form.description}
          payoutLabel={
            form.payoutTimestamp ? formatDateTimeWithTZ(form.payoutTimestamp) : undefined
          }
          copied={paymentLinkCopied}
          onCopy={handleCopyPaymentLink}
          onDone={() => router.push('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Whole-journey indicator. Connect is done by the time the wizard
          renders, and both the form and its review are "Payment Terms" -
          "Complete & Send" is the share screen after the request exists. */}
      <CreateProgressSteps current={showSuccessScreen ? 2 : 1} />

      <Wizard
        hideProgress
        steps={steps}
        currentStep={currentStep}
        onStepChange={(step) => {
          // Only allow going to previous steps or current step
          if (step <= currentStep) {
            setCurrentStep(step);
            setErrors({});
          }
        }}
        children={
          <>
            {renderStepContent()}
            
            <div className="mt-8">
              {currentStep === steps.length - 1 ? (
                // Final step: Single action button
                <div className="space-y-4">
                  {/* Previous button */}
                  {currentStep > 0 && (
                    <div className="flex justify-start">
                      <Button
                        onClick={handlePrevious}
                        variant="outline"
                        disabled={isLoading}
                      >
                        Previous
                      </Button>
                    </div>
                  )}

                  {/* Single action button - behavior depends on payment type */}
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      onClick={() => {
                        if (isInstantPayment) {
                          // Instant payment: Open QR modal
                          handleGenerateQR();
                        } else {
                          // Normal payment: Submit and send email
                          handleNext();
                        }
                      }}
                      disabled={!canProceed() || isLoading}
                      className="w-full sm:w-auto px-8"
                    >
                      {isLoading ? 'Creating...' : 'Create Payment Request'}
                    </Button>
                  </div>
                </div>
              ) : (
                // Other steps: Show standard navigation
                <WizardNavigation
                  currentStep={currentStep}
                  totalSteps={steps.length}
                  onNext={handleNext}
                  onPrevious={currentStep > 0 ? handlePrevious : undefined}
                  isNextDisabled={!canProceed()}
                  isNextLoading={isLoading}
                  nextLabel="Continue"
                />
              )}
            </div>
          </>
        }
      />

      {/* Payment QR Modal */}
      {showQRModal && (
        <PaymentQRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          url={generatePaymentUrl()}
          amount={form.amount}
          description={form.description}
          tokenSymbol={selectedTokenSymbol}
        />
      )}
    </div>
  );
}