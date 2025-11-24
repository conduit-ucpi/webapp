# Conduit Checkout - Website Integration Guide

Integrate secure stablecoin escrow payments into any website with just a few lines of JavaScript.

## 🚀 Quick Start

### 1. Include the Script

Add this to your website's HTML:

```html
<script src="https://app.instantescrow.nz/conduit-checkout.js"></script>
```

### 2. Initialize

Configure the checkout with your merchant wallet address:

```html
<script>
  ConduitCheckout.init({
    sellerAddress: '0xYourWalletAddress',
    baseUrl: 'https://app.instantescrow.nz',
    tokenSymbol: 'USDC', // 'USDC' or 'USDT' (default: 'USDC')
    expiryDays: 7, // Days until auto-release (default: 7)
    mode: 'popup', // or 'redirect'
    onSuccess: function(data) {
      console.log('Payment completed!', data);
      // Handle successful payment
    },
    onError: function(error) {
      console.log('Payment failed:', error);
      // Handle payment error
    },
    onCancel: function() {
      console.log('Payment cancelled');
      // Handle cancellation
    }
  });
</script>
```

### 3. Add Payment Buttons

```html
<button onclick="ConduitCheckout.open({
  amount: '50.00',
  description: 'Premium Plan - Monthly'
})">
  Pay $50 with USDC
</button>
```

## 🎨 Display Modes

### Popup Window (Recommended)
Opens checkout in a centered popup window. Best for minimal disruption.

```javascript
ConduitCheckout.init({
  mode: 'popup',
  // ... other options
});
```

### Full Page Redirect
Redirects to checkout page. Best for mobile or when popups are blocked.

```javascript
ConduitCheckout.init({
  mode: 'redirect',
  // ... other options
});
```

## ⚙️ Configuration Options

### `ConduitCheckout.init(options)`

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `sellerAddress` | string | **Yes** | - | Your wallet address to receive payments |
| `baseUrl` | string | **Yes** | - | Base URL of checkout page (e.g., `https://app.instantescrow.nz`) |
| `tokenSymbol` | string | No | `'USDC'` | Default token: `'USDC'` or `'USDT'` |
| `expiryDays` | number | No | `7` | Days until funds auto-release to seller |
| `mode` | string | No | `'popup'` | Display mode: `'popup'` or `'redirect'` |
| `onSuccess` | function | No | - | Callback when payment completes successfully |
| `onError` | function | No | - | Callback when payment fails |
| `onCancel` | function | No | - | Callback when user cancels payment |

### `ConduitCheckout.open(params)`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | string/number | **Yes** | Payment amount (e.g., `'50.00'`) |
| `description` | string | **Yes** | Payment description (max 160 chars) |
| `orderId` | string | No | Your internal order/transaction ID |
| `email` | string | No | Customer email address |
| `tokenSymbol` | string | No | Override default token for this payment |
| `expiryDays` | number | No | Override default expiry for this payment |
| `expiryTimestamp` | number | No | Custom expiry Unix timestamp (overrides `expiryDays`) |
| `webhookUrl` | string | No | Webhook URL for payment verification |
| `metadata` | object | No | Custom metadata to include |

## 💡 Examples

### Basic Product Sale

```html
<button onclick="ConduitCheckout.open({
  amount: '29.99',
  description: 'Premium Widget - Blue',
  orderId: 'ORDER-12345'
})">
  Buy Now - $29.99
</button>
```

### Product with Custom Expiry

```html
<button onclick="ConduitCheckout.open({
  amount: '99.00',
  description: 'Professional Service Package',
  orderId: 'SERVICE-' + Date.now(),
  expiryDays: 30, // 30-day buyer protection
  email: 'customer@example.com'
})">
  Purchase - $99
</button>
```

### Custom Amount (Donations, Tips, etc.)

```html
<input type="number" id="amount" placeholder="Enter amount" min="1.001" step="0.01">
<button onclick="
  const amount = document.getElementById('amount').value;
  ConduitCheckout.open({
    amount: amount,
    description: 'Support our project',
    orderId: 'DONATION-' + Date.now()
  });
">
  Donate with USDC
</button>
```

### USDT Payment

```html
<button onclick="ConduitCheckout.open({
  amount: '500.00',
  description: 'Enterprise License',
  tokenSymbol: 'USDT',
  expiryDays: 14
})">
  Pay $500 with USDT
</button>
```

### With Webhook Integration

```html
<button onclick="ConduitCheckout.open({
  amount: '49.99',
  description: 'Order #1234',
  orderId: '1234',
  webhookUrl: 'https://yoursite.com/api/payment-webhook',
  metadata: { sku: 'WIDGET-001', quantity: 2 }
})">
  Complete Purchase
</button>
```

## 🔔 Webhook Integration

If you provide a `webhookUrl`, Conduit will POST payment verification data to your endpoint after successful payment:

### Webhook Payload

```json
{
  "transaction_hash": "0x1234...",
  "contract_address": "0x5678...",
  "contract_id": "abc123",
  "order_id": "1234",
  "expected_amount": 50.00,
  "expected_recipient": "0x9abc...",
  "merchant_wallet": "0xdef0..."
}
```

### Webhook Endpoint Example (Node.js/Express)

```javascript
app.post('/api/payment-webhook', express.json(), async (req, res) => {
  const {
    transaction_hash,
    contract_id,
    order_id,
    expected_amount
  } = req.body;

  // Verify payment on blockchain if needed
  // Update your database
  // Fulfill order
  // Send confirmation email

  console.log(`Payment received for order ${order_id}:`, transaction_hash);

  res.json({ success: true });
});
```

## 📱 Mobile Support

The checkout automatically adapts to mobile devices:
- **Popup mode**: Opens in a new tab on mobile (popup restrictions)
- **Redirect mode**: Recommended for best mobile experience

## 🔒 Security Features

- **Client-side signing**: Users sign transactions with their own wallet
- **Escrow protection**: Funds held in smart contract, not directly to seller
- **Time-delayed release**: Buyer protection period before auto-release
- **Dispute mechanism**: Buyers can dispute via email within protection period
- **No gas fees**: Platform covers all blockchain transaction fees
- **HTTPS required**: All integrations must use HTTPS

## 🛠️ Advanced Usage

### Programmatic Control

```javascript
// Open checkout
ConduitCheckout.open({ amount: '10.00', description: 'Test' });

// Close checkout programmatically
ConduitCheckout.close();
```

### Dynamic Configuration

```javascript
// Change mode dynamically
ConduitCheckout.config.mode = 'redirect';

// Update callbacks
ConduitCheckout.config.onSuccess = function(data) {
  // New success handler
};
```

### Multiple Merchants on Same Page

```javascript
// Initialize for Merchant A
const merchantA = Object.create(ConduitCheckout);
merchantA.init({ sellerAddress: '0xMerchantA...' });

// Initialize for Merchant B
const merchantB = Object.create(ConduitCheckout);
merchantB.init({ sellerAddress: '0xMerchantB...' });

// Open checkouts
merchantA.open({ amount: '10', description: 'Product A' });
merchantB.open({ amount: '20', description: 'Product B' });
```

## 🧪 Testing

For testing, use the testnet deployment:

```javascript
ConduitCheckout.init({
  sellerAddress: '0xYourTestWallet',
  baseUrl: 'https://test.conduit-ucpi.com', // Testnet URL
  // ... other options
});
```

Test with Base Sepolia testnet USDC (free from faucets).

## 📊 Event Tracking

Track checkout events in your analytics:

```javascript
ConduitCheckout.init({
  sellerAddress: '0x...',
  baseUrl: 'https://app.instantescrow.nz',

  onSuccess: function(data) {
    // Track successful payment
    gtag('event', 'purchase', {
      transaction_id: data.contractId,
      value: parseFloat(data.amount),
      currency: 'USD'
    });
  },

  onError: function(error) {
    // Track payment failures
    gtag('event', 'exception', {
      description: 'Payment failed: ' + error,
      fatal: false
    });
  },

  onCancel: function() {
    // Track abandonment
    gtag('event', 'checkout_abandon');
  }
});
```

## ❓ FAQ

### What tokens are supported?
Currently USDC and USDT on Base network (Ethereum L2).

### What are the fees?
Fixed $1 fee per transaction, included in the amount. Minimum payment is $1.001.

### How long until seller receives funds?
Funds are auto-released after the expiry period (default 7 days) unless the buyer disputes.

### Can buyers get refunds?
Buyers can dispute within the protection period. Disputes are resolved by platform admin.

### What happens if buyer disputes?
Funds are frozen until admin reviews and resolves the dispute (release to seller or refund to buyer).

### Do I need a crypto wallet?
Yes, you need a wallet address to receive payments. We recommend MetaMask or Coinbase Wallet.

### What about gas fees?
Platform covers all gas fees. Buyers and sellers pay no gas.

## 🆘 Support

- **Documentation**: [docs.conduit-ucpi.com](https://docs.conduit-ucpi.com)
- **Email**: support@conduit-ucpi.com
- **Discord**: [discord.gg/conduit](https://discord.gg/conduit)

## 📄 License

MIT License - see LICENSE file for details
