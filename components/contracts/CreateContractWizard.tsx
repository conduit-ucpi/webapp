import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/AuthProvider';
import { useWallet } from '@/lib/wallet/WalletProvider';
import { useToast } from '@/components/ui/Toast';
import { Web3Service } from '@/lib/web3';
import { isValidEmail, isValidAmount, isValidDescription, toMicroUSDC, formatCurrency, formatDateTimeWithTZ } from '@/utils/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Wizard, WizardStep, WizardNavigation, WizardStep as Step } from '@/components/ui/Wizard';

interface CreateContractForm {
  buyerEmail: string;
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
  const { user } = useAuth();
  const { walletProvider } = useWallet();
  const { showToast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with tomorrow's date at current time
  const getDefaultTimestamp = (): number => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return Math.floor(tomorrow.getTime() / 1000);
  };

  const [form, setForm] = useState<CreateContractForm>({
    buyerEmail: '',
    amount: '',
    payoutTimestamp: getDefaultTimestamp(),
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Utility functions (same as original)
  const getUserTimezone = () => {
    const date = new Date();
    const timeString = date.toLocaleTimeString('en-US', { 
      timeZoneName: 'short' 
    });
    const parts = timeString.split(' ');
    return parts[parts.length - 1];
  };

  const timestampToDatetimeLocal = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const datetimeLocalToTimestamp = (datetimeLocal: string): number => {
    const date = new Date(datetimeLocal);
    return Math.floor(date.getTime() / 1000);
  };

  const getCurrentLocalDatetime = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getMaxLocalDatetime = (): string => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    const year = oneYearFromNow.getFullYear();
    const month = (oneYearFromNow.getMonth() + 1).toString().padStart(2, '0');
    const day = oneYearFromNow.getDate().toString().padStart(2, '0');
    const hours = oneYearFromNow.getHours().toString().padStart(2, '0');
    const minutes = oneYearFromNow.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getRelativeTime = (timestamp: number): string => {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = timestamp - now;
    
    if (diffSeconds <= 0) return 'in the past';
    
    const diffMins = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffDays = Math.floor(diffSeconds / 86400);
    
    if (diffMins < 60) return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `in ${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
    
    const diffMonths = Math.floor(diffDays / 30);
    return `in ${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  };

  // Validation for each step
  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};
    
    switch (step) {
      case 0: // Basic Details
        if (!isValidEmail(form.buyerEmail)) {
          newErrors.buyerEmail = 'Please enter a valid email address';
        }
        if (!isValidDescription(form.description)) {
          newErrors.description = 'Description must be 1-160 characters';
        }
        break;
        
      case 1: // Payment Terms
        if (!isValidAmount(form.amount)) {
          newErrors.amount = 'Please enter a valid amount';
        }
        
        const now = Math.floor(Date.now() / 1000);
        const oneYearFromNow = now + (365 * 24 * 60 * 60);
        
        if (!form.payoutTimestamp || form.payoutTimestamp <= 0) {
          newErrors.expiry = 'Please select a valid date and time';
        } else if (form.payoutTimestamp <= now) {
          newErrors.expiry = 'Payout time must be in the future';
        } else if (form.payoutTimestamp > oneYearFromNow) {
          newErrors.expiry = 'Payout time must be within 1 year';
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
    if (!validateStep(2) || !config) return;

    setIsLoading(true);
    
    try {
      if (!walletProvider) {
        throw new Error('Wallet not connected');
      }

      if (!config.usdcContractAddress) {
        throw new Error('USDC contract address not configured');
      }

      const web3Service = new Web3Service(config);
      await web3Service.initializeProvider(walletProvider);
      
      const userAddress = await web3Service.getUserAddress();
      
      const pendingContractRequest = {
        buyerEmail: form.buyerEmail,
        sellerEmail: user?.email || '',
        sellerAddress: userAddress,
        amount: toMicroUSDC(form.amount.trim()),
        currency: 'microUSDC',
        description: form.description,
        expiryTimestamp: form.payoutTimestamp,
        serviceLink: config.serviceLink
      };

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingContractRequest)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create contract');
      }

      showToast({
        type: 'success',
        title: 'Payment request created!',
        message: `${form.buyerEmail} will receive an email notification.`
      });

      router.push('/dashboard');
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
          <WizardStep>
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Who's the buyer?
            </h2>
            <p className="text-secondary-600 mb-6">
              Tell us who will be making the payment and what this request is for.
            </p>
            
            <div className="space-y-6">
              <Input
                label="Buyer's email address"
                type="email"
                value={form.buyerEmail}
                onChange={(e) => setForm(prev => ({ ...prev, buyerEmail: e.target.value }))}
                placeholder="buyer@example.com"
                error={errors.buyerEmail}
                helpText="They'll receive an email with payment instructions"
              />

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
                  This will appear in the payment request email to the buyer.
                </p>
              </div>
            </div>
          </WizardStep>
        );

      case 1:
        return (
          <WizardStep>
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Payment terms
            </h2>
            <p className="text-secondary-600 mb-6">
              Set the amount and when funds should be released.
            </p>
            
            <div className="space-y-6">
              <div>
                <Input
                  label="Amount (USDC)"
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="100.00"
                  error={errors.amount}
                  helpText="Amount must be over $1, or exactly 0.001 for testing"
                />
                <div className="mt-2 p-3 bg-info-50 border border-info-200 rounded-md">
                  <p className="text-sm text-info-800">
                    💡 <strong>How it works:</strong> The buyer pays this amount upfront. 
                    Funds are held securely until the release date, then automatically 
                    transferred to you.
                  </p>
                </div>
              </div>

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
            </div>
          </WizardStep>
        );

      case 2:
        return (
          <WizardStep>
            <h2 className="text-xl font-semibold text-secondary-900 mb-2">
              Review payment request
            </h2>
            <p className="text-secondary-600 mb-6">
              Double-check the details before sending to the buyer.
            </p>
            
            <div className="space-y-6">
              {/* Contract Summary */}
              <div className="bg-secondary-50 rounded-lg p-4">
                <h3 className="font-medium text-secondary-900 mb-4">Payment Request Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Buyer:</span>
                    <span className="font-medium">{form.buyerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Amount:</span>
                    <span className="font-medium text-lg">
                      {formatCurrency(toMicroUSDC(form.amount || '0'), 'microUSDC').amount} USDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary-600">Release date:</span>
                    <span className="font-medium">
                      {formatDateTimeWithTZ(form.payoutTimestamp)}
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
                <ol className="space-y-2 text-sm text-primary-800">
                  <li className="flex items-start">
                    <span className="font-medium mr-2">1.</span>
                    <span>{form.buyerEmail} receives an email with payment instructions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-medium mr-2">2.</span>
                    <span>They pay {formatCurrency(toMicroUSDC(form.amount || '0'), 'microUSDC').amount} USDC to our secure escrow</span>
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
          </WizardStep>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return form.buyerEmail && form.description;
      case 1:
        return form.amount && form.payoutTimestamp;
      case 2:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
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
      >
        {renderStepContent()}
        
        <div className="mt-8">
          <WizardNavigation
            currentStep={currentStep}
            totalSteps={steps.length}
            onNext={handleNext}
            onPrevious={currentStep > 0 ? handlePrevious : undefined}
            isNextDisabled={!canProceed()}
            isNextLoading={isLoading}
          />
        </div>
      </Wizard>
    </div>
  );
}