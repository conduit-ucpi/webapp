import { useEffect, useRef } from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useAuth } from '@/components/auth/AuthProvider';

interface MoonPayWidgetProps {
  onClose?: () => void;
  mode?: 'buy' | 'sell';
}

export default function MoonPayWidget({ onClose, mode = 'buy' }: MoonPayWidgetProps) {
  const { config } = useConfig();
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!config || !user) return;

    // MoonPay widget URL with parameters
    const params = new URLSearchParams({
      apiKey: config.moonPayApiKey,
      currencyCode: 'usdc',
      walletAddress: user.walletAddress,
      colorCode: '#3b82f6',
      redirectURL: window.location.origin + '/dashboard',
    });

    // Use different MoonPay URLs for buy vs sell
    const baseUrl = mode === 'buy' 
      ? 'https://buy-sandbox.moonpay.com' 
      : 'https://sell-sandbox.moonpay.com';
    
    const moonPayUrl = `${baseUrl}?${params.toString()}`;
    
    if (iframeRef.current) {
      iframeRef.current.src = moonPayUrl;
    }

    // Listen for messages from MoonPay
    const handleMessage = (event: MessageEvent) => {
      const allowedOrigins = ['https://buy-sandbox.moonpay.com', 'https://sell-sandbox.moonpay.com'];
      if (!allowedOrigins.includes(event.origin)) return;
      
      if (event.data.type === 'close') {
        onClose?.();
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [config, user, onClose, mode]);

  if (!config || !user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MoonPay...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[600px]">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg"
        title="MoonPay Widget"
        allow="payment"
      />
    </div>
  );
}