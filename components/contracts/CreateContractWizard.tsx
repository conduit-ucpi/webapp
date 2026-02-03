import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useToast } from '@/components/ui/Toast';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import BuyerInput from '@/components/ui/BuyerInput';
import WalletInfo from '@/components/ui/WalletInfo';
import PaymentQRModal from '@/components/ui/PaymentQRModal';
import CurrencyAmountInput from '@/components/ui/CurrencyAmountInput';
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
  timestampToDatetimeLocal,
  datetimeLocalToTimestamp,
  getDefaultTimestamp,
  getCurrentLocalDatetime,
  getMaxLocalDatetime,
  getRelativeTime
} from '@/utils/validation';

interface CreateContractForm {
  buyerEmail: string;
  buyerType: 'email' | 'farcaster';
  buyerFid?: number;
  amount: string;
  payoutTimestamp: number;
  description: string;
}

interface FormErrors {
  buyerEmail?: string;
  amount?: string;
  expiry?: string;
  description?: string;
}

const steps: Step[] = [
  {
    id: 'details',
    title: 'Basic Details',
    description: 'Who and what'
  },
  {
    id: 'payment',
    title: 'Payment Terms', 
    description: 'Amount and timing'
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
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showQRModal, setShowQRModal] = useState(false);
  const [isInstantPayment, setIsInstantPayment] = useState(false);
  const [noBuyerEmail, setNoBuyerEmail] = useState(false);
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>(
    config?.defaultTokenSymbol || config?.tokenSymbol || 'USDC'
  );

  // Determine available tokens based on config
  const availableTokens: Array<{ symbol: string; details: any }> = [];
  if (config?.usdcDetails || config?.usdcContractAddress) {
    availableTokens.push({ symbol: 'USDC', details: config?.usdcDetails });
  }
  if (config?.usdtDetails) {
    availableTokens.push({ symbol: 'USDT', details: config?.usdtDetails });
  }
  const hasMultipleTokens = availableTokens.length > 1;

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
  }, [isConnected, address, user, hasAttemptedUserFetch, refreshUserData]);

  // Utility functions (same as original)
  const getUserTimezone = () => {
    const date = new Date();
    const timeString = date.toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    });
    const parts = timeString.split(' ');
    return parts[parts.length - 1];
  };

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

  // Copy payment link to clipboard
  const handleCopyPaymentLink = async () => {
    const link = generateContractPaymentLink();
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 3000);
      showToast({
        type: 'success',
        title: 'Link copied!',
        message: 'Payment link copied to clipboard'
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      showToast({
        type: 'error',
        title: 'Copy failed',
        message: 'Could not copy link to clipboard'
      });
    }
  };

  // Handle in-person QR code generation
  const handleGenerateQR = () => {
    if (!validateStep(2)) {
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
            if (user?.email && buyerIdentifier.toLowerCase() === user.email.toLowerCase()) {
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
        break;
        
      case 1: // Payment Terms
        // Use SDK utils if available, otherwise fall back to local validation
        const amountValidator = isValidAmount;

        if (!amountValidator(form.amount)) {
          newErrors.amount = 'Please enter a valid amount';
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
        
      case 2: // Review - validate everything
        return validateStep(0) && validateStep(1);
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
      if (!config.usdcContractAddress) {
        throw new Error('USDC contract address not configured');
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
        serviceLink: config.serviceLink
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
              <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                {isInstantPayment ? 'Payment details' : "Who's the buyer?"}
              </h2>
              <p className="text-secondary-600 mb-6">
                {isInstantPayment
                  ? 'Set up an instant QR code payment for in-person transactions.'
                  : 'Tell us who will be making the payment and what this request is for.'
                }
              </p>

              <div className="space-y-6">
                {/* Instant Payment Checkbox */}
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="instantPayment"
                    checked={isInstantPayment}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsInstantPayment(checked);
                      if (checked) {
                        // Set timestamp to 0 for instant payment and clear buyer email
                        setForm(prev => ({
                          ...prev,
                          payoutTimestamp: 0,
                          buyerEmail: '',
                          buyerType: 'email',
                          buyerFid: undefined
                        }));
                      } else {
                        // Reset to default timestamp when unchecked
                        setForm(prev => ({ ...prev, payoutTimestamp: getDefaultTimestamp() }));
                      }
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded mt-0.5"
                  />
                  <label htmlFor="instantPayment" className="ml-3 block text-sm text-secondary-700">
                    <span className="font-medium">Instant QR code payment</span>
                    <p className="text-secondary-500 mt-1">
                      For in-person transactions - funds are released immediately after payment (no email needed)
                    </p>
                  </label>
                </div>

                {/* Buyer email - only show if NOT instant payment */}
                {!isInstantPayment && (
                  <>
                    <BuyerInput
                      label="Buyer's email address"
                      value={form.buyerEmail}
                      onChange={(value, type, fid) => setForm(prev => ({
                        ...prev,
                        buyerEmail: value,
                        buyerType: type,
                        buyerFid: fid
                      }))}
                      error={errors.buyerEmail}
                      placeholder="Search Farcaster user or enter email"
                      helpText={noBuyerEmail ? "You'll notify the buyer manually with the payment link" : "They'll receive an email with payment instructions"}
                      disabled={noBuyerEmail}
                    />

                    {/* No buyer email checkbox */}
                    <div className="flex items-start -mt-2">
                      <input
                        type="checkbox"
                        id="noBuyerEmail"
                        checked={noBuyerEmail}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNoBuyerEmail(checked);
                          if (checked) {
                            // Clear buyer email when checkbox is checked
                            setForm(prev => ({
                              ...prev,
                              buyerEmail: '',
                              buyerType: 'email',
                              buyerFid: undefined
                            }));
                            // Clear any buyer email errors
                            setErrors(prev => ({ ...prev, buyerEmail: undefined }));
                          }
                        }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded mt-0.5"
                      />
                      <label htmlFor="noBuyerEmail" className="ml-3 block text-sm text-secondary-700">
                        <span className="font-medium">No buyer email - I'll share the payment link myself</span>
                        <p className="text-secondary-500 mt-1">
                          You'll get a shareable payment link to send directly to the buyer
                        </p>
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    What are you selling? ({form.description.length}/160)
                  </label>
                  <textarea
                    className="w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    maxLength={160}
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of what you're selling..."
                  />
                  {errors.description && (
                    <p className="text-sm text-error-600 mt-1">{errors.description}</p>
                  )}
                  <p className="text-xs text-secondary-500 mt-2">
                    {isInstantPayment
                      ? 'This will appear on the QR code payment screen.'
                      : 'This will appear in the payment request email to the buyer.'
                    }
                  </p>
                </div>
              </div>
            </>
          } />
        );

      case 1:
        return (
          <WizardStep children={
            <>
              <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                Payment terms
              </h2>
              <p className="text-secondary-600 mb-6">
                {isInstantPayment
                  ? 'Set the amount for this instant payment.'
                  : 'Set the amount and when funds should be released.'
                }
              </p>

              <div className="space-y-6">
                {/* Token Selector - only show if multiple tokens available */}
                {hasMultipleTokens && (
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Payment Token
                    </label>
                    <select
                      className="w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={selectedTokenSymbol}
                      onChange={(e) => setSelectedTokenSymbol(e.target.value)}
                    >
                      {availableTokens.map((token) => (
                        <option key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-secondary-500 mt-2">
                      Select which stablecoin the buyer will use for payment
                    </p>
                  </div>
                )}

                <div>
                  <CurrencyAmountInput
                    label={`Amount (${selectedTokenSymbol})`}
                    value={form.amount}
                    onChange={(value) => setForm(prev => ({ ...prev, amount: value }))}
                    tokenSymbol={selectedTokenSymbol as 'USDC' | 'USDT'}
                    error={errors.amount}
                    helpText="Amount must be over $1, or exactly 0.001 for testing"
                  />
                  <div className="mt-2 p-3 bg-info-50 border border-info-200 rounded-md">
                    <p className="text-sm text-info-800">
                      💡 <strong>How it works:</strong> The buyer pays this amount upfront.
                      {isInstantPayment
                        ? ' Funds are released to you immediately after payment.'
                        : ' Funds are held securely until the release date, then automatically transferred to you.'
                      }
                    </p>
                  </div>
                </div>

                {/* Conditional datetime input - only show if NOT instant payment */}
                {!isInstantPayment && (
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      When should funds be released?
                      <span className="ml-2 text-xs font-normal text-secondary-500">
                        (Your timezone: {getUserTimezone()})
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full border border-secondary-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      value={timestampToDatetimeLocal(form.payoutTimestamp)}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        payoutTimestamp: datetimeLocalToTimestamp(e.target.value)
                      }))}
                      min={getCurrentLocalDatetime()}
                      max={getMaxLocalDatetime()}
                    />
                    {errors.expiry && (
                      <p className="text-sm text-error-600 mt-1">{errors.expiry}</p>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-xs text-secondary-500">
                        Funds will be released automatically at this time
                      </p>
                      {form.payoutTimestamp && !errors.expiry && (
                        <p className="text-xs font-medium text-primary-600">
                          {getRelativeTime(form.payoutTimestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          } />
        );

      case 2:
        return (
          <WizardStep children={
            <>
              <h2 className="text-xl font-semibold text-secondary-900 mb-2">
                Review payment request
              </h2>
              <p className="text-secondary-600 mb-6">
                Double-check the details before sending to the buyer.
              </p>
              
              <div className="space-y-6">
                {/* Contract Summary */}
                <div className="bg-secondary-50 rounded-lg p-4">
                  <h3 className="font-medium text-secondary-900 mb-4">
                    {isInstantPayment ? 'QR Code Payment Summary' : 'Payment Request Summary'}
                  </h3>
                  <div className="space-y-3">
                    {!isInstantPayment && !noBuyerEmail && (
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Buyer:</span>
                        <span className="font-medium">{form.buyerEmail}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-secondary-600">Amount:</span>
                      <span className="font-medium text-lg">
                        {formatUSDC(toMicroUSDC(parseFloat(form.amount || '0')))} {selectedTokenSymbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-600">Release date:</span>
                      <span className="font-medium">
                        {isInstantPayment ? 'Instant (no delay)' : formatDateTimeWithTZ(form.payoutTimestamp)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-secondary-600">Description:</span>
                      <span className="font-medium text-right max-w-xs">
                        {form.description}
                      </span>
                    </div>
                  </div>
                </div>

                {/* What happens next */}
                <div className="bg-primary-50 rounded-lg p-4">
                  <h3 className="font-medium text-primary-900 mb-3">What happens next?</h3>
                  {isInstantPayment ? (
                    <ol className="space-y-2 text-sm text-primary-800">
                      <li className="flex items-start">
                        <span className="font-medium mr-2">1.</span>
                        <span>A QR code will be generated for in-person payment</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">2.</span>
                        <span>The buyer scans the QR code and pays {formatUSDC(toMicroUSDC(parseFloat(form.amount || '0')))} {selectedTokenSymbol}</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">3.</span>
                        <span>Funds are released to you immediately after payment confirmation</span>
                      </li>
                    </ol>
                  ) : noBuyerEmail ? (
                    <ol className="space-y-2 text-sm text-primary-800">
                      <li className="flex items-start">
                        <span className="font-medium mr-2">1.</span>
                        <span>You'll receive a payment link to share with the buyer</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">2.</span>
                        <span>The buyer clicks the link and pays {formatUSDC(toMicroUSDC(parseFloat(form.amount || '0')))} {selectedTokenSymbol} to our secure escrow</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">3.</span>
                        <span>Funds are automatically released to you on {formatDateTimeWithTZ(form.payoutTimestamp)}</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">4.</span>
                        <span>Both parties can raise disputes if needed before the release date</span>
                      </li>
                    </ol>
                  ) : (
                    <ol className="space-y-2 text-sm text-primary-800">
                      <li className="flex items-start">
                        <span className="font-medium mr-2">1.</span>
                        <span>{form.buyerEmail} receives an email with payment instructions</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">2.</span>
                        <span>They pay {formatUSDC(toMicroUSDC(parseFloat(form.amount || '0')))} {selectedTokenSymbol} to our secure escrow</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">3.</span>
                        <span>Funds are automatically released to you on {formatDateTimeWithTZ(form.payoutTimestamp)}</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-medium mr-2">4.</span>
                        <span>Both parties can raise disputes if needed before the release date</span>
                      </li>
                    </ol>
                  )}
                </div>


                {/* Edit buttons */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-secondary-200">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="text-sm"
                  >
                    Edit Details
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="text-sm"
                  >
                    Edit Payment Terms
                  </Button>
                </div>
              </div>
            </>
          } />
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        // For instant payment, only description is needed
        // For noBuyerEmail, only description is needed
        // For normal payment, email + description
        return isInstantPayment || noBuyerEmail ? !!form.description : !!(form.buyerEmail && form.description);
      case 1:
        // For instant payment, timestamp can be 0; for delayed payment, it must be set
        return form.amount && (isInstantPayment || form.payoutTimestamp > 0);
      case 2:
        return user && user.walletAddress; // Only allow final submission when user is authenticated
      default:
        return false;
    }
  };

  // Show success screen after contract creation
  if (showSuccessScreen && createdContractId) {
    const paymentLink = generateContractPaymentLink();

    return (
      <div className="w-full max-w-2xl mx-auto">
        {/* Wallet Info Section */}
        <WalletInfo className="mb-6" />

        <div className="bg-white rounded-lg border border-secondary-200 p-8">
          {/* Success Header */}
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-secondary-900 mb-2">Payment Request Created!</h2>
            <p className="text-secondary-600">
              {isInstantPayment
                ? 'Your QR code payment request is ready'
                : noBuyerEmail
                  ? 'Your payment link is ready to share with the buyer'
                  : `An email has been sent to ${form.buyerEmail}`
              }
            </p>
          </div>

          {/* Payment Link Section */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-primary-900 mb-3">Share Payment Link</h3>
            <p className="text-sm text-primary-800 mb-4">
              Send this link directly to the buyer for instant payment:
            </p>

            {/* Link Display with Copy Button */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={paymentLink}
                className="flex-1 text-sm border border-primary-300 rounded-md px-3 py-2 bg-white font-mono text-primary-900"
              />
              <Button
                onClick={handleCopyPaymentLink}
                className={`${
                  paymentLinkCopied
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-primary-500 hover:bg-primary-600'
                } whitespace-nowrap`}
              >
                {paymentLinkCopied ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Contract Summary */}
          <div className="bg-secondary-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-secondary-900 mb-3">Payment Request Summary</h3>
            <div className="space-y-2 text-sm">
              {!isInstantPayment && !noBuyerEmail && (
                <div className="flex justify-between">
                  <span className="text-secondary-600">Buyer:</span>
                  <span className="font-medium">{form.buyerEmail}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary-600">Amount:</span>
                <span className="font-medium">{formatUSDC(toMicroUSDC(parseFloat(form.amount || '0')))} {selectedTokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Release Date:</span>
                <span className="font-medium">
                  {isInstantPayment ? 'Instant' : formatDateTimeWithTZ(form.payoutTimestamp)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Contract ID:</span>
                <span className="font-mono text-xs">{createdContractId}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-primary-500 hover:bg-primary-600"
            >
              Go to Dashboard
            </Button>
            <Button
              onClick={() => {
                // Reset wizard for new payment request
                setShowSuccessScreen(false);
                setCreatedContractId(null);
                setCurrentStep(0);
                setForm({
                  buyerEmail: '',
                  buyerType: 'email',
                  buyerFid: undefined,
                  amount: '',
                  payoutTimestamp: getDefaultTimestamp(),
                  description: ''
                });
                setErrors({});
                setIsInstantPayment(false);
                setNoBuyerEmail(false);
                setPaymentLinkCopied(false);
              }}
              variant="outline"
              className="flex-1"
            >
              Create Another Request
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Wallet Info Section */}
      <WalletInfo className="mb-6" />

      <Wizard
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
                      className="w-full sm:w-auto px-8 bg-primary-500 hover:bg-primary-600"
                    >
                      {isLoading ? 'Creating...' : 'Create Payment Request'}
                    </Button>

                    <p className="text-sm text-secondary-500 text-center">
                      {isInstantPayment
                        ? 'A QR code will be generated for instant in-person payment'
                        : 'An email notification will be sent to the buyer'
                      }
                    </p>
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