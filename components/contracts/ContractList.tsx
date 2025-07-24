import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import { Contract } from '@/types';
import ContractCard from './ContractCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ContractList() {
  const { user } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchContracts = async () => {
    if (!user?.walletAddress) return;

    try {
      const response = await fetch(`${router.basePath}/api/chain/contracts/${user.walletAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }
      
      const data = await response.json();
      setContracts(data.contracts || []);
      setError('');
    } catch (error: any) {
      console.error('Failed to fetch contracts:', error);
      setError(error.message || 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (contracts.some(c => c.status === 'active' && Date.now() / 1000 > c.expiryTimestamp - 300)) {
        fetchContracts();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.walletAddress]);

  const handleContractAction = () => {
    fetchContracts(); // Refresh after any action
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-600 mb-4">{error}</div>
        <button 
          onClick={fetchContracts}
          className="text-primary-600 hover:text-primary-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-600 mb-4">No contracts found</div>
        <p className="text-gray-500">Create your first escrow contract to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {contracts.map((contract) => (
        <ContractCard
          key={contract.contractAddress}
          contract={contract}
          onAction={handleContractAction}
        />
      ))}
    </div>
  );
}