# Shopify USDC Payment Integration Guide

This guide explains how to integrate USDC payments with buyer protection into any Shopify store using the Conduit UCPI webapp.

## Overview

The integration allows any Shopify merchant to accept USDC payments with:
- **14-day escrow protection** for buyers
- **No monthly fees** - only 1% transaction fee
- **No gas fees** for customers
- **Direct wallet payouts** for merchants

## Initial Setup - Shopify App Configuration

### Prerequisites

Before merchants can use your integration, you need to configure the Shopify app in your Partners account:

1. **Go to Shopify Partners:**
   ```
   https://partners.shopify.com
   ```

2. **Navigate to your app:**
   - Click on "Apps" in the sidebar
   - Select your app (buyer-protected-usdc-checkout)

3. **Configure App URLs:**

   In the **App setup** section, configure these URLs:

   **For Production (app.instantescrow.nz):**

   - **App URL:**
     ```
     https://app.instantescrow.nz/shopify
     ```

   - **Allowed redirection URL(s):** Add ALL of these (one per line):
     ```
     https://app.instantescrow.nz/api/shopify/callback
     https://app.instantescrow.nz/shopify/merchant-settings
     https://app.instantescrow.nz/shopify/install-button
     https://app.instantescrow.nz/shopify
     ```

   **For Test Environment (test.conduit-ucpi.com):**

   - **App URL:**
     ```
     https://test.conduit-ucpi.com/shopify
     ```

   - **Allowed redirection URL(s):** Add ALL of these (one per line):
     ```
     https://test.conduit-ucpi.com/api/shopify/callback
     https://test.conduit-ucpi.com/shopify/merchant-settings
     https://test.conduit-ucpi.com/shopify/install-button
     https://test.conduit-ucpi.com/shopify
     ```

   **Note:** You can have multiple redirect URLs, so add both test and production URLs if you want to test in both environments.

4. **Configure OAuth scopes (if not already set):**
   - `write_orders` - To create orders
   - `write_draft_orders` - To create draft orders
   - `write_products` - To read product information
   - `read_customers` - To read customer information

5. **Save your changes**

### Environment Variables Required

Make sure your webapp has these environment variables configured:

```bash
# From your Shopify app settings
SHOPIFY_CLIENT_ID=3d76e8d2767514c1a7775ff91432a995
SHOPIFY_CLIENT_SECRET=ad56e2021d08a7ccf4091ac4f9f8eabb
SHOPIFY_NAME=buyer-protected-usdc-checkout
SHOPIFY_SCOPES=write_orders,write_draft_orders,write_products,read_customers

# Generate a secure random string
SESSION_SECRET=<generate-a-secure-random-string>

# Optional - for persistent storage (otherwise uses in-memory)
MONGODB_URI=mongodb://...
```

## Merchant Setup Process

### Step 1: Connect Your Shopify Store

1. **Visit the setup page:**
   ```
   https://[your-webapp-domain]/shopify/install-button
   ```

2. **Enter your shop domain:**
   - Enter your Shopify store domain (e.g., `your-store.myshopify.com`)
   - Click "Connect Store"

3. **Authorize the connection:**
   - You'll be redirected to Shopify
   - Review the permissions requested
   - Click "Install app" to authorize

### Step 2: Configure Your Settings

After authorizing, you'll be redirected to the merchant settings page where you need to:

1. **Enter your wallet address:**
   - This is where you'll receive USDC payments
   - Must be a valid Ethereum/Base wallet address (0x...)
   - Example: `0x742C3cF9Af45f91B109a81EfEaf11535ECDe9571`

2. **Set your escrow period:**
   - Choose between 7-30 days (14 days recommended)
   - This is how long buyers have to dispute orders
   - After this period, funds automatically release to your wallet

3. **Save your settings:**
   - Click "Save Settings & Continue"
   - You'll be redirected to the installation instructions

### Step 3: Add the Payment Button to Your Store

There are three ways to add the USDC payment button to your Shopify store:

#### Option A: Simple Installation (Recommended)

1. **Copy this single line of code:**
   ```html
   <script src="https://[your-webapp-domain]/shopify-checkout.js" async></script>
   ```

2. **Add it to your theme:**
   - Go to your Shopify Admin
   - Navigate to **Online Store → Themes**
   - Click **Actions → Edit code**
   - Find the file `layout/theme.liquid`
   - Paste the code just before `</head>`
   - Click **Save**

3. **That's it!** The button will automatically appear on:
   - All product pages
   - Cart page (as Express Checkout)
   - Quick shop modals

#### Option B: Custom Button (Advanced)

If you want more control over button placement:

```html
<!-- Load the script -->
<script src="https://[your-webapp-domain]/shopify-checkout.js"></script>

<!-- Create custom button anywhere -->
<button onclick="InstantEscrow.checkout()">
  Pay with USDC
</button>

<!-- Or trigger programmatically -->
<script>
  document.getElementById('my-button').addEventListener('click', function() {
    InstantEscrow.checkout();
  });
</script>
```

#### Option C: Liquid Template Integration

For direct integration into product templates:

```liquid
{% comment %} Add to sections/product-template.liquid {% endcomment %}
{% if product.available %}
  <button
    onclick="window.open('https://[your-webapp-domain]/shopify/quick-checkout?shop={{ shop.domain }}&product_id={{ product.id }}&variant_id={{ product.selected_or_first_available_variant.id }}&title={{ product.title | escape }}&price={{ product.price | money_without_currency }}&quantity=1', 'instantEscrow', 'width=500,height=700')"
    style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;"
  >
    Buy with USDC - Instant Checkout
  </button>
{% endif %}
```

## How It Works

### For Merchants:
1. Customer clicks "Buy with USDC" button on your product page
2. Secure checkout window opens
3. Customer pays with USDC (via wallet or email)
4. Payment held in smart contract escrow
5. After escrow period, USDC automatically sent to your wallet

### For Customers:
1. Click "Buy with USDC - Instant Checkout" on any product
2. Connect wallet or use email (Web3Auth)
3. Approve USDC payment (no gas fees)
4. Get 14-day protection period
5. Can dispute if product not received

## Button Appearance

The button automatically styles itself to look professional on any store:

```
[Buy with USDC - Instant Checkout]
🔒 Protected by 14-day escrow • No gas fees
```

- Purple gradient background
- White text
- Responsive width
- Hover effects

## Testing Your Integration

1. **Visit your store in incognito mode** to see the button as customers would
2. **Try a test purchase** with a small amount
3. **Check the payment flow** opens correctly
4. **Verify your wallet address** is shown in the checkout

## Monitoring Payments

Track all your payments at:
```
https://[your-webapp-domain]/dashboard
```

Login with the same wallet address you configured to see:
- Pending payments (in escrow)
- Completed payments
- Disputed orders
- Payment history

## Troubleshooting

### Button not appearing?
- Check the script is added before `</head>` in theme.liquid
- Clear your browser cache
- Ensure JavaScript is enabled

### "Merchant Not Configured" error?
- Complete the setup process starting from Step 1
- Ensure you saved your wallet address and settings
- Contact support if the issue persists

### Payment not going to your wallet?
- Verify your wallet address is correct in settings
- Check the escrow period hasn't expired yet
- Payments release automatically after the escrow period

## Important Notes

- **FREE to install** - No monthly fees or setup costs
- **1% transaction fee** - Only charged on successful payments
- **Escrow protection** - All payments protected for configured period
- **No chargebacks** - Blockchain transactions are final after escrow
- **Global payments** - Accept USDC from anywhere in the world

## Support

For assistance or questions:
- Visit: https://[your-webapp-domain]/shopify
- Dashboard: https://[your-webapp-domain]/dashboard

## Security

- Smart contracts audited and deployed on Base network
- No access to merchant private keys
- All transactions require customer signature
- Escrow ensures buyer protection

---

## Quick Start Checklist

- [ ] Connected Shopify store via OAuth
- [ ] Configured wallet address for payouts
- [ ] Set escrow period (14 days recommended)
- [ ] Added JavaScript code to theme.liquid
- [ ] Tested button appears on product pages
- [ ] Completed test transaction
- [ ] Bookmarked dashboard for monitoring

Once complete, you're ready to accept USDC payments with buyer protection!