import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth/AuthProvider';
import ConnectWallet from '@/components/auth/ConnectWallet';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import USDCGuide from '@/components/ui/USDCGuide';
import { useWeb3AuthInstance } from '@/components/auth/Web3AuthContextProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useState, useEffect } from 'react';

export default function BuyUSDC() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { config } = useConfig();
  const { web3authInstance, web3authProvider, isLoading: isWeb3AuthInstanceLoading } = useWeb3AuthInstance();
  const { walletAddress, isLoading: isWalletAddressLoading } = useWalletAddress();
  const [widgetStatus, setWidgetStatus] = useState<string>('');

  const tryShowWalletServices = async () => {
    try {
      setWidgetStatus('Opening wallet services...');
      console.log('Trying to show wallet services');
      console.log('Web3Auth instance:', web3authInstance);
      
      if (!web3authInstance) {
        setWidgetStatus('Web3Auth instance not found');
        return;
      }

      // Check if the plugin exists
      const plugins = (web3authInstance as any).plugins;
      console.log('Available plugins:', plugins);
      
      // Try to get the wallet services plugin
      const walletServicesPlugin = plugins?.['wallet-services'];
      console.log('Wallet services plugin:', walletServicesPlugin);
      
      if (walletServicesPlugin) {
        // Check if user is connected first
        if (!web3authInstance.connected) {
          setWidgetStatus('Please connect your wallet first');
          return;
        }

        console.log('Plugin status:', walletServicesPlugin.status);
        
        // If plugin is not connected yet, wait for it to connect
        if (walletServicesPlugin.status !== 'connected') {
          setWidgetStatus('Waiting for wallet services to connect...');
          
          // Listen for the connected event
          const onPluginConnected = () => {
            console.log('Plugin connected, showing wallet UI');
            // Pass parameters to open directly to buy/sell with USDC pre-selected
            const walletUiParams = {
              path: 'topup', // or 'buy' depending on what path the widget supports
              params: {
                currency: 'USDC',
                chainId: config?.chainId || 43113,
                // You can also add amount if needed:
                // amount: 100, // Amount in USDC
              }
            };
            walletServicesPlugin.showWalletUi(walletUiParams).then(() => {
              setWidgetStatus('Wallet services opened!');
            }).catch((err: any) => {
              console.error('Error showing UI after connect:', err);
              setWidgetStatus(`Could not open wallet services: ${err.message}`);
            });
            // Remove the event listener
            walletServicesPlugin.off('connected', onPluginConnected);
          };
          
          walletServicesPlugin.on('connected', onPluginConnected);
          
          // The plugin should auto-connect when Web3Auth is connected
          // Let's check if it's initializing
          setTimeout(() => {
            if (walletServicesPlugin.status !== 'connected') {
              console.log('Plugin still not connected, checking Web3Auth connection...');
              console.log('Web3Auth connected:', web3authInstance.connected);
              console.log('Web3Auth provider:', web3authInstance.provider);
              
              // The plugin should connect automatically when Web3Auth connects
              // If not, there might be a configuration issue
              setWidgetStatus('Wallet services may not be configured. Check the widget in the bottom-right corner.');
              
              // Try showing the UI anyway in case the status is wrong
              const walletUiParams = {
                path: 'topup',
                params: {
                  currency: 'USDC',
                  chainId: config?.chainId || 43113,
                }
              };
              walletServicesPlugin.showWalletUi(walletUiParams).catch((err: any) => {
                console.error('Error showing UI directly:', err);
              });
            }
          }, 2000);
          
        } else {
          // Plugin is already connected, show the UI with parameters
          const walletUiParams = {
            path: 'topup', // or 'buy' depending on what path the widget supports
            params: {
              currency: 'USDC',
              chainId: config?.chainId || 43113,
              // You can also add amount if needed:
              // amount: 100, // Amount in USDC
            }
          };
          await walletServicesPlugin.showWalletUi(walletUiParams);
          setWidgetStatus('Wallet services opened!');
        }
      } else {
        setWidgetStatus('Wallet services not available');
      }
    } catch (error: any) {
      console.error('Error showing wallet services:', error);
      setWidgetStatus(`Could not open wallet services: ${error.message}`);
    }
  };

  // Automatically open wallet services when page loads and user is authenticated
  useEffect(() => {
    if (user && web3authProvider && walletAddress && web3authInstance) {
      // Small delay to ensure everything is fully loaded
      const timer = setTimeout(() => {
        tryShowWalletServices();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [user, web3authProvider, walletAddress, web3authInstance]);

  if (isLoading || isWeb3AuthInstanceLoading || isWalletAddressLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || !web3authProvider || !walletAddress) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
        <p className="text-gray-600 mb-6">
          You need to connect your wallet to buy or sell USDC.
        </p>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Buy or Sell USDC</h1>
          <p className="mt-2 text-gray-600">
            Manual instructions for adding USDC to your wallet or converting to fiat
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Web3Auth Wallet Services Integration */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Web3Auth Wallet Services</h2>
              <p className="text-gray-600 mb-4">
                Use the integrated wallet widget to buy, sell, swap, and manage your crypto
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">Widget Access:</span> Look for the wallet widget button (usually bottom-right corner) 
                    to access fiat on-ramp, portfolio management, and token swapping features.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Connected Wallet:</span>
                <span className="text-sm font-mono text-gray-900">{walletAddress}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Network:</span>
                <span className="text-sm text-gray-900">
                  {(() => {
                    const chainNames: Record<number, string> = {
                      1: 'Ethereum Mainnet',
                      11155111: 'Sepolia Testnet',
                      43114: 'Avalanche C-Chain',
                      43113: 'Avalanche Fuji Testnet',
                      137: 'Polygon Mainnet',
                      80001: 'Mumbai Testnet',
                      8453: 'Base Mainnet',
                      84532: 'Base Sepolia',
                      42161: 'Arbitrum One',
                      421614: 'Arbitrum Sepolia',
                      10: 'Optimism Mainnet',
                      11155420: 'Optimism Sepolia',
                      56: 'BNB Smart Chain',
                      97: 'BSC Testnet',
                    };
                    return chainNames[config?.chainId || 0] || `Chain ID: ${config?.chainId}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Supported Currency:</span>
                <span className="text-sm text-gray-900">USDC</span>
              </div>
            </div>
          </div>

          {/* Fallback: Show the USDCGuide component with manual instructions */}
          <details className="bg-white rounded-lg shadow-md p-6 mb-8">
            <summary className="cursor-pointer font-semibold text-gray-900 mb-4">
              Alternative: Manual Instructions (click to expand)
            </summary>
            <USDCGuide />
          </details>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">Active:</span> Web3Auth Wallet Services are now integrated and available through the wallet widget.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {widgetStatus && (
                <div className={`p-3 rounded-lg text-sm ${
                  widgetStatus.includes('not') || widgetStatus.includes('Could not')
                    ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                    : widgetStatus.includes('opened')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}>
                  <div className="flex items-center">
                    {(widgetStatus.includes('Opening') || widgetStatus.includes('Waiting')) && (
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                    )}
                    {widgetStatus}
                  </div>
                </div>
              )}

              <Button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-primary-500 hover:bg-primary-600"
                size="lg"
              >
                Go to Dashboard
              </Button>

              <div className="text-center">
                <button
                  onClick={() => router.back()}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              Powered by Web3Auth Wallet Services. The widget provides secure access to multiple 
              fiat on-ramp providers and DeFi services for your convenience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}