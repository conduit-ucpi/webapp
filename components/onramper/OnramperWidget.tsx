import React, { useState, useEffect } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useWalletAddress } from '@/hooks/useWalletAddress';

interface OnramperWidgetProps {
  mode?: 'buy' | 'sell';
  defaultAmount?: number;
  defaultCrypto?: string;
  defaultFiat?: string;
  isTestMode?: boolean;
}

const OnramperWidget: React.FC<OnramperWidgetProps> = ({
  mode = 'buy',
  defaultAmount,
  defaultCrypto = 'usdc_avalanche',
  defaultFiat = 'usd',
  isTestMode = false,
}) => {
  const { config } = useConfig();
  const { walletAddress } = useWalletAddress();
  const [widgetUrl, setWidgetUrl] = useState<string>('');

  useEffect(() => {
    // Build the Onramper URL with all parameters
    const baseUrl = 'https://buy.onramper.com';
    const params = new URLSearchParams();
    
    // Use API key from config, fallback to test key for testing
    const apiKey = config?.onramperApiKey || (isTestMode ? 'pk_test_01K2BYWTYW8EDRXN2SHATHCVYP' : '');
    
    if (!apiKey) {
      console.error('Onramper API key not configured');
      return;
    }
    
    params.append('apiKey', apiKey);
    params.append('mode', mode);
    
    // Add wallet address if available
    if (walletAddress) {
      params.append('walletAddress', walletAddress);
    }
    
    // Add network configuration
    if (config?.chainId) {
      // Map chainId to Onramper network identifier
      const networkMap: { [key: number]: string } = {
        43113: 'avalanche_fuji', // Fuji testnet
        43114: 'avalanche', // Avalanche mainnet
      };
      const network = networkMap[config.chainId];
      if (network) {
        params.append('defaultNetwork', network);
      }
    }
    
    // Add default crypto (USDC on Avalanche)
    params.append('defaultCrypto', defaultCrypto);
    
    // Add default fiat currency
    params.append('defaultFiat', defaultFiat);
    
    // Add amount if specified
    if (defaultAmount) {
      params.append('defaultAmount', defaultAmount.toString());
    }
    
    // Add theme customization
    params.append('themeName', 'dark');
    params.append('primaryColor', '#3B82F6'); // Blue-500
    params.append('secondaryColor', '#1F2937'); // Gray-800
    params.append('containerColor', '#FFFFFF');
    params.append('cardColor', '#F9FAFB'); // Gray-50
    
    // Disable certain features for simplicity
    params.append('isAddressEditable', 'false');
    params.append('hideExchangeScreen', 'false');
    
    // For direct checkout (skip transaction screen if all params are provided)
    if (defaultAmount && walletAddress) {
      params.append('skipTransactionScreen', 'true');
      params.append('txnAmount', defaultAmount.toString());
      params.append('txnFiat', defaultFiat);
      params.append('txnCrypto', defaultCrypto);
      if (mode === 'buy') {
        params.append('txnPaymentMethod', 'creditcard');
      } else {
        params.append('txnPaymentMethod', 'banktransfer');
      }
    }
    
    setWidgetUrl(`${baseUrl}?${params.toString()}`);
  }, [mode, defaultAmount, defaultCrypto, defaultFiat, walletAddress, config, isTestMode]);

  if (!widgetUrl) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Loading Onramper widget...</p>
      </div>
    );
  }

  // Log the widget URL for debugging
  console.log('Onramper Widget URL:', widgetUrl);

  return (
    <div className="onramper-widget-container">
      <iframe
        src={widgetUrl}
        title="Onramper Widget"
        className="w-full rounded-lg shadow-lg"
        style={{ 
          height: '630px',
          border: 'none',
          maxWidth: '100%',
        }}
        allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
        allowFullScreen
      />
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Debug Info:</strong> If the widget appears blank with 403 errors, the domain needs to be whitelisted in Onramper dashboard.
          </p>
          <p className="text-xs text-yellow-700 mt-2">
            API Key: {config?.onramperApiKey ? `${config.onramperApiKey.substring(0, 10)}...` : 'Not configured'}<br/>
            Widget URL: <a href={widgetUrl} target="_blank" rel="noopener noreferrer" className="underline">Open directly</a>
          </p>
        </div>
      )}
    </div>
  );
};

export default OnramperWidget;