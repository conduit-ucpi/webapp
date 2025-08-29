import { useState } from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth';
import { useWeb3SDK } from '@/hooks/useWeb3SDK';
import { PendingContract } from '@/types';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ContractAcceptanceProps {
  contract: PendingContract;
  onAcceptComplete: () => void;
}

export default function ContractAcceptance({ contract, onAcceptComplete }: ContractAcceptanceProps) {
  const router = useRouter();
  const { config } = useConfig();
  const { 
    user, 
    authenticatedFetch, 
    fundContract
  } = useAuth();
  const { utils } = useWeb3SDK(); // Only keep utils from SDK
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAccept = async () => {
    if (!config) {
      alert('Configuration not loaded');
      return;
    }

    // Prevent double-clicks
    if (isLoading || isSuccess) return;

    setIsLoading(true);
    setLoadingMessage('Checking contract status...');
    setHasError(false);

    try {
      // First, get fresh contract data to check status
      const contractResponse = await authenticatedFetch(`/api/contracts/${contract.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!contractResponse.ok) {
        const errorData = await contractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch contract status');
      }

      const freshContract = await contractResponse.json();

      // Check if contract is already being processed
      if (freshContract.state === 'IN-PROCESS') {
        throw new Error('This contract is already being processed. Please wait and refresh the page.');
      }

      // Only proceed if state is OK
      if (freshContract.state && freshContract.state !== 'OK') {
        throw new Error(`Contract cannot be accepted. State: ${freshContract.state}`);
      }

      setLoadingMessage('Initializing...');
      
      // Check if user is authenticated and has wallet address
      if (!user?.walletAddress) {
        throw new Error('Please connect your wallet first.');
      }
      
      // Use the wallet address from the authenticated user directly
      const userAddress = user.walletAddress;
      
      console.log('User from auth context:', user);
      console.log('Using actual user wallet address:', userAddress);
      
      // Verify that the current user's email matches the contract's buyer email (if specified)
      if (contract.buyerEmail && user?.email !== contract.buyerEmail) {
        throw new Error(`This contract is for ${contract.buyerEmail}, but you are logged in as ${user?.email}. Please log in with the correct account.`);
      }

      // Check if fundContract is available from the auth provider
      console.log('🔧 ContractAcceptance: fundContract availability:', {
        fundContract: !!fundContract,
        fundContractType: typeof fundContract,
        authUser: !!user,
        authProvider: user?.authProvider
      });
      
      if (!fundContract) {
        throw new Error('Contract funding not available for this authentication provider');
      }

      setLoadingMessage('Step 1 of 3: Creating secure escrow...');

      // Fund the contract using the provider-specific implementation
      console.log('🔧 ContractAcceptance: About to call fundContract with params');
      
      try {
        const result = await fundContract({
          contract: {
            id: contract.id,
            amount: contract.amount,
            currency: contract.currency,
            sellerAddress: contract.sellerAddress,
            expiryTimestamp: contract.expiryTimestamp,
            description: contract.description,
            buyerEmail: contract.buyerEmail,
            sellerEmail: contract.sellerEmail
          },
          userAddress,
          config: {
            usdcContractAddress: config.usdcContractAddress,
            serviceLink: config.serviceLink
          },
          utils: {
            toMicroUSDC: utils?.toMicroUSDC,
            toUSDCForWeb3: utils?.toUSDCForWeb3,
            formatDateTimeWithTZ: utils?.formatDateTimeWithTZ
          },
          onProgress: (step: string) => {
            console.log('🔧 ContractAcceptance: Progress update:', step);
            setLoadingMessage(step);
          }
        });

        console.log('🔧 ContractAcceptance: Contract funding completed successfully:', result);
      } catch (fundingError) {
        console.error('🔧 ContractAcceptance: Contract funding failed:', fundingError);
        console.error('🔧 ContractAcceptance: Funding error details:', {
          message: fundingError instanceof Error ? fundingError.message : 'Unknown error',
          name: fundingError instanceof Error ? fundingError.name : 'Unknown',
          stack: fundingError instanceof Error ? fundingError.stack : 'No stack'
        });
        throw fundingError;
      }

      // Mark as success to prevent double-clicks during redirect
      setIsSuccess(true);
      setLoadingMessage('Success! Redirecting...');

      // Notify parent component
      onAcceptComplete();

      // Redirect to dashboard with error handling
      try {
        await router.push('/dashboard');
      } catch (error) {
        console.error('Redirect failed:', error);
        // Fallback: reload the page to trigger navigation
        window.location.href = '/dashboard';
      }

      // Fallback timeout in case redirect doesn't work
      setTimeout(() => {
        if (window.location.pathname !== '/dashboard') {
          window.location.href = '/dashboard';
        }
      }, 3000);
    } catch (error: any) {
      console.error('Contract acceptance failed:', error);
      setHasError(true);
      alert(error.message || 'Failed to accept contract');
      // Only re-enable on error
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  if (isLoading || isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{loadingMessage}</p>
        {isSuccess && (
          <p className="mt-2 text-green-600 font-medium">Contract accepted successfully!</p>
        )}
      </div>
    );
  }

  // Show processing state if contract is already being processed
  if (contract.state === 'IN-PROCESS') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Being Processed</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-600">Amount:</span>
            <span className="font-medium">${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Seller:</span>
            <span>{contract.sellerEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Description:</span>
            <span className="text-right max-w-xs">{contract.description}</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center">
            <LoadingSpinner className="w-4 h-4 mr-2" />
            <p className="text-sm text-blue-800">
              This contract is currently being processed. Please wait and refresh the page to see updates.
            </p>
          </div>
        </div>

        <Button
          disabled={true}
          className="w-full bg-gray-400 cursor-not-allowed opacity-50"
        >
          Processing...
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Make time-lock payment</h3>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount:</span>
          <span className="font-medium">${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Seller:</span>
          <span>{contract.sellerEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Description:</span>
          <span className="text-right max-w-xs">{contract.description}</span>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
        <p className="text-sm text-yellow-800">
          When you make this payment, the ${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC will be held securely in escrow until {utils?.formatDateTimeWithTZ ? utils.formatDateTimeWithTZ(contract.expiryTimestamp) : new Date(contract.expiryTimestamp * 1000).toISOString()}.
        </p>
      </div>

      <Button
        onClick={handleAccept}
        disabled={isLoading || isSuccess}
        className={`w-full bg-primary-500 hover:bg-primary-600 ${(isLoading || isSuccess) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        Make Payment of ${utils?.formatCurrency ? utils.formatCurrency(contract.amount, contract.currency || 'microUSDC').amount : contract.amount} USDC
      </Button>
    </div>
  );
}