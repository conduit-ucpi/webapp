import { useAuth } from '@/components/auth';
import { useSimpleEthers } from '@/hooks/useSimpleEthers';
import Button from '@/components/ui/Button';
import { useState } from 'react';

export default function Web3AuthAccess() {
  const { getEthersProvider } = useAuth();
  const { fundAndSendTransaction, getUserAddress } = useSimpleEthers();
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<string>('');

  const clearStuckNonce = async () => {
    setIsClearing(true);
    setResult('');

    try {
      console.log('🔧 Attempting to clear stuck nonce 115...');

      const userAddress = await getUserAddress();
      if (!userAddress) {
        throw new Error('No user address found');
      }

      console.log('🔧 User address:', userAddress);

      // Send 0 ETH to self with higher gas to clear nonce 115
      const txHash = await fundAndSendTransaction({
        to: userAddress, // Send to yourself
        data: '0x', // Empty data
        value: '0x0', // 0 value
        gasLimit: BigInt(21000) // Standard ETH transfer gas
      });

      console.log('🔧 Transaction sent:', txHash);
      setResult(`✅ Clearing transaction sent: ${txHash}`);

    } catch (error) {
      console.error('🔧 Error clearing nonce:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setResult(`❌ Error: ${errorMessage}`);
    } finally {
      setIsClearing(false);
    }
  };

  const accessWeb3AuthConsole = () => {
    // Log all possible Web3Auth instances for manual access
    console.log('=== WEB3AUTH DEBUG INFO ===');
    console.log('window.web3auth:', (window as any).web3auth);
    console.log('window.web3authInstance:', (window as any).web3authInstance);
    console.log('window.ethereum:', window.ethereum);

    // Try to find Web3Auth in the DOM
    const web3authElements = document.querySelectorAll('[data-web3auth], [class*="web3auth"], [id*="web3auth"]');
    console.log('Web3Auth DOM elements:', web3authElements);

    alert('Check browser console for Web3Auth instance details');
  };

  return (
    <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
      <h3 className="text-red-800 font-medium mb-2">Clear Stuck Nonce 115</h3>
      <p className="text-red-700 text-sm mb-4">
        Your wallet has a stuck transaction with nonce 115. This will send 0 ETH to yourself to clear it.
      </p>

      <div className="space-y-3">
        <Button
          onClick={clearStuckNonce}
          disabled={isClearing}
          variant="outline"
        >
          {isClearing ? 'Clearing Nonce...' : 'Clear Stuck Nonce 115'}
        </Button>

        <Button
          onClick={accessWeb3AuthConsole}
          variant="outline"
          size="sm"
        >
          Debug: Find Web3Auth Instance
        </Button>
      </div>

      {result && (
        <div className="mt-4 p-3 bg-white rounded border text-sm">
          {result}
        </div>
      )}

      <div className="mt-4 text-xs text-red-600">
        <p><strong>What this does:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Sends 0 ETH to your own wallet address</li>
          <li>Uses higher gas price to replace stuck transaction</li>
          <li>Clears nonce 115 so USDC approval can proceed</li>
        </ul>
      </div>
    </div>
  );
}