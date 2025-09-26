import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

export default function MerchantSettings() {
  const router = useRouter();
  const { shop, success } = router.query;
  const [walletAddress, setWalletAddress] = useState('');
  const [payoutDelayDays, setPayoutDelayDays] = useState(14);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (success === 'true') {
      toast.success('Successfully connected to Shopify! Please configure your settings.');
    }
  }, [success]);

  useEffect(() => {
    if (shop) {
      // Fetch existing settings
      fetch(`/api/shopify/settings?shop=${encodeURIComponent(shop as string)}`)
        .then(res => res.json())
        .then(data => {
          if (data.walletAddress) {
            setWalletAddress(data.walletAddress);
            setPayoutDelayDays(data.payoutDelayDays);
          }
        })
        .catch(error => {
          console.error('Failed to fetch settings:', error);
        })
        .finally(() => setIsFetching(false));
    }
  }, [shop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shop) {
      toast.error('Shop parameter is missing');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/shopify/settings?shop=${encodeURIComponent(shop as string)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          payoutDelayDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      toast.success('Settings saved successfully!');

      // Redirect to install instructions
      router.push(`/shopify/install-button?shop=${encodeURIComponent(shop as string)}&configured=true`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: '40px', background: '#fafbfb', minHeight: '100vh' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '8px', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: '40px', background: '#fafbfb', minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '8px', padding: '40px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#202223', marginBottom: '16px', fontSize: '32px' }}>⚙️ Configure Your USDC Payments</h1>
        <p style={{ color: '#6d7175', fontSize: '16px', marginBottom: '32px' }}>
          Set up your wallet address and payout delay for receiving USDC payments from your Shopify store.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: '#202223', fontWeight: '600', marginBottom: '8px' }}>
              Your Wallet Address
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              required
              pattern="^0x[a-fA-F0-9]{40}$"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #dfe3e8',
                borderRadius: '8px',
                fontSize: '16px',
                fontFamily: 'monospace',
              }}
            />
            <p style={{ fontSize: '14px', color: '#6d7175', marginTop: '8px' }}>
              This is where you'll receive USDC payments after the escrow period.
            </p>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', color: '#202223', fontWeight: '600', marginBottom: '8px' }}>
              Escrow Period (days)
            </label>
            <select
              value={payoutDelayDays}
              onChange={(e) => setPayoutDelayDays(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #dfe3e8',
                borderRadius: '8px',
                fontSize: '16px',
              }}
            >
              {[7, 10, 14, 21, 30].map(days => (
                <option key={days} value={days}>
                  {days} days {days === 14 && '(recommended)'}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '14px', color: '#6d7175', marginTop: '8px' }}>
              Buyer protection period. Funds are held in escrow and can be disputed during this time.
            </p>
          </div>

          <div style={{ background: '#f0f8ff', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 12px', color: '#667eea' }}>💡 How it works:</h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#6d7175' }}>
              <li>Customer pays with USDC at checkout</li>
              <li>Funds held in smart contract escrow for {payoutDelayDays} days</li>
              <li>Customer can dispute if product not received</li>
              <li>After {payoutDelayDays} days, USDC automatically sent to your wallet</li>
              <li>Only 1% transaction fee (no monthly fees!)</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '16px 32px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              width: '100%',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Saving...' : 'Save Settings & Continue'}
          </button>
        </form>

        {shop && (
          <p style={{ marginTop: '24px', fontSize: '14px', color: '#6d7175', textAlign: 'center' }}>
            Connected to: <strong>{shop}</strong>
          </p>
        )}
      </div>
    </div>
  );
}