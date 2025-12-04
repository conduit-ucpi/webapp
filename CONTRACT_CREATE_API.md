# Contract Create API Documentation

## Overview

The `/contract-create` page accepts URL parameters to pre-fill payment information and integrate with external systems like WordPress and Shopify.

## URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `seller` | string | Seller's wallet address (0x...) | `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb` |
| `amount` | string | Payment amount in USDC/USDT | `100.00` |
| `description` | string | Description of the purchase (max 160 chars) | `Order for blue t-shirt` |
| `email` | string | Buyer's email address | `buyer@example.com` |
| `return` | string | Return URL after payment completion | `https://shop.com/order-received/123/?key=wc_order_abc` |
| `order_id` | string | Order ID for tracking | `456` |
| `epoch_expiry` | string | Unix timestamp for payout date (use `0` for instant) | `1735689600` or `0` |
| `shop` | string | Shopify shop domain | `mystore.myshopify.com` |
| `product_id` | string | Shopify product ID | `789` |
| `variant_id` | string | Shopify variant ID | `012` |
| `title` | string | Product title (for Shopify orders) | `Blue T-Shirt` |
| `quantity` | string | Quantity of items | `2` |
| `webhook_url` | string | Webhook URL for payment verification | `https://shop.com/wp-json/usdc-payments/v1/webhook` |
| `wordpress_source` | string | Set to `'true'` to enable WordPress integration | `true` |
| `tokenSymbol` | string | Token to use (`'USDC'` or `'USDT'`) | `USDC` |

## Parameter Behavior

- **Pre-filled and Disabled**: If `seller`, `amount`, or `description` are provided via URL, those form fields will be pre-filled and disabled (user cannot edit).
- **Authentication**: If `email` is provided but user is authenticated, the authenticated user's email takes precedence.
- **Default Values**:
  - `epoch_expiry`: Defaults to 7 days from now if not provided
  - `quantity`: Defaults to `1` if not provided
  - `tokenSymbol`: Defaults to `'USDC'` or the configured `defaultTokenSymbol`

## Integration Types

### Basic Payment

Minimal parameters for a simple escrow payment:

```
https://app.conduit-ucpi.com/contract-create
  ?seller=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  &amount=100.00
  &description=Purchase
```

### WordPress Integration

For WordPress WooCommerce integration with webhook verification:

```
https://app.conduit-ucpi.com/contract-create
  ?seller=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  &amount=100.00
  &description=Order%20456
  &order_id=456
  &wordpress_source=true
  &webhook_url=https://shop.com/wp-json/usdc-payments/v1/webhook
  &return=https://shop.com/order-received/456/?key=wc_order_abc123
  &epoch_expiry=0
```

**WordPress-specific behavior:**
- When `wordpress_source=true`, special payment status URLs are generated
- Return URL format: `{origin}/usdc-payment-status/{order_id}/?key={order_key}&payment_status={status}`
- Payment status values: `completed`, `cancelled`, `error`
- Webhook is sent to `webhook_url` after successful payment (if provided)

### Shopify Integration

For Shopify app integration with automatic order creation:

```
https://app.conduit-ucpi.com/contract-create
  ?seller=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  &amount=50.00
  &description=T-Shirt
  &shop=mystore.myshopify.com
  &product_id=789
  &variant_id=012
  &title=Blue%20T-Shirt
  &quantity=2
  &order_id=345
```

**Shopify-specific behavior:**
- Triggers automatic order creation via `/api/shopify/create-order`
- Order is created after successful blockchain payment
- All parameters are included in the Shopify order creation request

### Custom Integration with Webhook

For custom integrations that need payment confirmation webhooks:

```
https://app.conduit-ucpi.com/contract-create
  ?seller=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  &amount=100.00
  &description=API%20Service
  &webhook_url=https://api.example.com/payment-webhook
  &order_id=789
  &return=https://example.com/success
```

**Custom integration behavior:**
- Webhook is sent to `webhook_url` after successful payment
- Can be combined with any other parameters
- Works with both USDC and USDT (add `&tokenSymbol=USDT`)
- No WordPress or Shopify-specific behavior

### USDT Payment

To use USDT instead of USDC:

```
https://app.conduit-ucpi.com/contract-create
  ?seller=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  &amount=100.00
  &description=Service
  &tokenSymbol=USDT
```

## Webhook Payload

**Webhooks are triggered whenever the `webhook_url` parameter is provided.**

After successful payment, a POST request with payment verification data will be sent to the specified webhook URL. This works with any integration type (WordPress, Shopify, custom, etc.).

### Webhook Request

**Endpoint:** The URL provided in the `webhook_url` parameter

**Method:** `POST`

**Content-Type:** `application/json`

### Webhook Payload Structure

The webapp sends the following data to `/api/payment/verify-and-webhook`, which then forwards it to your webhook URL:

```json
{
  "transaction_hash": "0xabc123...",
  "contract_address": "0xdef456...",
  "contract_hash": "0xdef456...",
  "contract_id": "507f1f77bcf86cd799439011",
  "webhook_url": "https://shop.com/wp-json/usdc-payments/v1/webhook",
  "order_id": 456,
  "expected_amount": 100.00,
  "expected_recipient": "0xdef456...",
  "merchant_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Webhook Payload Fields

| Field | Type | Description |
|-------|------|-------------|
| `transaction_hash` | string | Blockchain transaction hash of the deposit |
| `contract_address` | string | Deployed escrow contract address on blockchain |
| `contract_hash` | string | Same as `contract_address` (for compatibility) |
| `contract_id` | string | MongoDB contract ID from contractservice |
| `webhook_url` | string | The webhook URL (echo back for verification) |
| `order_id` | number | Order ID from URL parameters |
| `expected_amount` | number | Expected payment amount in USDC/USDT |
| `expected_recipient` | string | Expected recipient address (the escrow contract) |
| `merchant_wallet` | string | Seller's wallet address |

### Webhook Response

Your webhook endpoint should respond with:

- **Success**: HTTP 200-299 status code
- **Failure**: HTTP 4xx or 5xx status code

**Note:** The payment flow does NOT fail if the webhook fails. The payment is considered successful as long as the blockchain transaction succeeds. Webhook failures are logged but do not affect the payment status.

### Webhook Verification

To verify the webhook is authentic, your endpoint should:

1. **Verify the transaction on the blockchain** using `transaction_hash`
2. **Check the amount** transferred matches `expected_amount`
3. **Verify the recipient** is `expected_recipient` (the escrow contract address)
4. **Confirm the contract exists** using `contract_id` or `contract_address`
5. **Validate the merchant** wallet matches your configured seller address

### Example Webhook Implementation (Node.js)

```javascript
app.post('/webhook', async (req, res) => {
  const {
    transaction_hash,
    contract_address,
    contract_id,
    order_id,
    expected_amount,
    expected_recipient,
    merchant_wallet
  } = req.body;

  try {
    // 1. Verify transaction on blockchain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const receipt = await provider.getTransactionReceipt(transaction_hash);

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction not found or failed');
    }

    // 2. Verify amount and recipient (parse transaction logs)
    // ... blockchain verification logic ...

    // 3. Update order status in your database
    await updateOrderStatus(order_id, 'paid', {
      transaction_hash,
      contract_address,
      contract_id
    });

    // 4. Send confirmation
    res.status(200).json({ success: true, order_id });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(400).json({ error: error.message });
  }
});
```

## Redirect Behavior

### Standard Redirect (No WordPress)

After payment completion, the user is redirected to:
- `return` URL if provided
- `/dashboard` if no return URL

### WordPress Redirect

When `wordpress_source=true`, the return URL is transformed to:

```
{shop_origin}/usdc-payment-status/{order_id}/?key={order_key}&payment_status=completed&contract_id={contract_id}&contract_hash={contract_address}&tx_hash={transaction_hash}
```

**Example:**
```
https://shop.com/usdc-payment-status/456/?key=wc_order_abc123&payment_status=completed&contract_id=507f1f77bcf86cd799439011&contract_hash=0xdef456...&tx_hash=0xabc123...
```

### Payment Status Values

| Status | When Used | Additional Params |
|--------|-----------|-------------------|
| `completed` | Payment successful | `contract_id`, `contract_hash`, `tx_hash` |
| `cancelled` | User clicked Cancel button | None |
| `error` | Payment failed | `error` (error message) |

## Instant Payments

To create an instant payment (funds released immediately):

```
?epoch_expiry=0
```

**Behavior:**
- Funds are released to the seller immediately after blockchain confirmation
- No dispute period
- Payout date displays as "Instant"
- Confirmation message: "Funds will be released immediately after payment confirmation"

**Use case:** Digital goods, services, or when buyer protection is not needed.

## Error Handling

### Insufficient Balance

If the buyer's wallet balance is less than the requested amount:
- Warning displayed on the create step
- Payment button disabled on the payment step
- Error message shows exact shortfall amount

### Invalid Seller Address

If `seller` parameter is not a valid Ethereum address:
- Validation error displayed: "Please enter a valid wallet address"

### Contract Creation Failure

If contract creation fails:
- Error alert displayed to user
- `payment_error` postMessage sent to parent (if in iframe)
- User remains on create step to retry

### Payment Failure

If payment transaction fails:
- Error displayed in payment progress UI
- WordPress users redirected to error status page
- `payment_error` postMessage sent to parent (if in iframe)

## PostMessage Events (iframe/popup)

When embedded in an iframe or opened as a popup, the page sends postMessage events:

### Event Types

```typescript
type PostMessageEvent = {
  type: 'contract_created' | 'payment_completed' | 'payment_cancelled' | 'payment_error' | 'close_modal';
  data?: any;
  error?: string;
}
```

### Events

**contract_created:**
```json
{
  "type": "contract_created",
  "data": {
    "contract_id": "507f1f77bcf86cd799439011",
    "amount": "100.00",
    "description": "Order 456",
    "seller": "0x742d35Cc...",
    "orderId": "456"
  }
}
```

**payment_completed:**
```json
{
  "type": "payment_completed",
  "data": {
    "contractId": "507f1f77bcf86cd799439011",
    "amount": "100.00",
    "description": "Order 456",
    "seller": "0x742d35Cc...",
    "orderId": "456",
    "transactionHash": "0xabc123..."
  }
}
```

**payment_cancelled:**
```json
{
  "type": "payment_cancelled"
}
```

**payment_error:**
```json
{
  "type": "payment_error",
  "error": "Insufficient balance"
}
```

**close_modal:**
```json
{
  "type": "close_modal"
}
```

## Security Notes

1. **Wallet Validation**: All wallet addresses are validated before processing
2. **Amount Validation**: Minimum amount is $1.001 (includes $1 fee)
3. **Balance Check**: User balance is verified before allowing payment
4. **Transaction Signing**: All transactions are signed client-side by the user
5. **Webhook Verification**: Payment verification is separate from webhook delivery (payment succeeds even if webhook fails)
6. **Authentication**: User must authenticate via Web3Auth before creating contracts
7. **Cookie-based Sessions**: HTTP-only cookies used for authenticated API requests

## Testing

### Test Parameters

For testing, use Base Sepolia testnet:

```
https://test.conduit-ucpi.com/contract-create
  ?seller=0xTEST_WALLET_ADDRESS
  &amount=1.50
  &description=Test%20Order
  &epoch_expiry=0
```

### Getting Test USDC

1. Connect wallet to app
2. Use the "Get Test USDC" feature in wallet dropdown
3. Receive testnet USDC tokens
4. Create and fund test contract
