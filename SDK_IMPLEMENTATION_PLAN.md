# Conduit UCPI SDK Implementation Plan

## Executive Summary

Transform the current standalone Next.js webapp into an embeddable SDK that provides a **complete escrow management platform** that can be embedded into any website with a simple script tag. The SDK will consist of two packages:

1. **Shared API Proxy** - Single server-side service YOU run for all customers
2. **Widget Package** - Client-side JavaScript bundle that embeds the full dashboard UI

All backend services (chainservice, contractservice, userservice, productservice) remain on Conduit infrastructure. **No merchant authentication or API keys needed** - the blockchain wallet address is the merchant identifier.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANY Website (Merchant's Site)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  <script src="cdn.conduit-ucpi.com/widget.js"></script>    │ │
│  │  <div id="conduit-escrow"></div>                           │ │
│  │  <script>                                                   │ │
│  │    ConduitWidget.init({                                    │ │
│  │      mode: 'full',                    // or 'create'/'dashboard' │
│  │      defaultRecipient: '0xMerchant...', // Optional pre-fill │ │
│  │      theme: 'light'                                        │ │
│  │    });                                                      │ │
│  │  </script>                                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Widget Renders Complete Dashboard Inside Div:                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Dashboard] [Create] [Wallet]                              │ │
│  │                                                             │ │
│  │ 📊 Stats: $12,500 in escrow | 8 active contracts          │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────┐                  │ │
│  │ │ Contract #1234 - $500 USDC           │                  │ │
│  │ │ [View] [Fund] [Claim] [Dispute]      │                  │ │
│  │ └──────────────────────────────────────┘                  │ │
│  │                                                             │ │
│  │ [+ Create New Payment Request]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────────┘
                           │ fetch() calls
┌──────────────────────────▼───────────────────────────────────────┐
│              YOUR Shared API Proxy (You Host This)               │
│              https://api.conduit-ucpi.com                         │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Next.js API Routes (/api/*)                                 ││
│  │  - User authentication (wallet signatures)                   ││
│  │  - NO merchant authentication needed                         ││
│  │  - Proxies to backend services                               ││
│  │  - CORS: Allow all origins (or registered domains)           ││
│  │  - Cookies on .conduit-ucpi.com domain                       ││
│  └─────────────────────────┬────────────────────────────────────┘│
└────────────────────────────┼─────────────────────────────────────┘
                             │ Authenticated Requests
┌────────────────────────────▼─────────────────────────────────────┐
│                   Conduit Backend Services (Unchanged)            │
│  ┌──────────────┬──────────────┬──────────────┬────────────────┐ │
│  │ userservice  │ chainservice │ contract     │ product        │ │
│  │ (Port 8977)  │ (Port 8978)  │ service      │ service        │ │
│  │              │              │ (Port 8080)  │ (Port 8979)    │ │
│  └──────────────┴──────────────┴──────────────┴────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ MongoDB Database                                             │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Base Blockchain Network                                      │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### **No Merchant API Keys**

**Why?** The recipient wallet address IS the merchant identifier.

- User creates contract and specifies recipient wallet address
- That wallet address identifies who the "merchant" is
- Blockchain is the source of truth
- No need for centralized merchant accounts or API keys

**Security model:**
- ✅ User authenticates with wallet signature (SIWE)
- ✅ User can only modify their own contracts
- ✅ Recipient wallet address is immutable (on blockchain)
- ✅ No merchant credentials to steal or expose
- ✅ **Recipient-scoped authentication** - Sessions tied to specific recipient wallet
- ✅ **Automatic re-auth on recipient change** - Prevents paying wrong merchant

### **Single Shared API Proxy**

**Why?** Simpler than requiring each merchant to self-host.

- YOU run one API proxy for ALL merchants
- CORS allows all origins (or registered domains)
- Cookies set on YOUR domain (`.conduit-ucpi.com`)
- All requests authenticated by user wallet, not merchant identity
- **Recipient-scoped sessions** - User must re-authenticate when recipient changes

**Benefits:**
- ✅ Zero deployment friction for merchants
- ✅ You control updates and monitoring
- ✅ Centralized logging and analytics
- ✅ Easier to optimize and scale
- ✅ Security: User can't accidentally pay wrong merchant (must sign for each recipient)

### **Complete Dashboard UI**

**Why?** Merchants want turnkey escrow platform, not just payment button.

Widget includes ALL current webapp functionality:
- ✅ Dashboard with stats and contract list
- ✅ Contract creation wizard
- ✅ Fund, claim, dispute actions
- ✅ Wallet management
- ✅ Search and filtering
- ✅ Responsive mobile-friendly UI

**Modes:**
- `full` - Complete platform (dashboard + create + wallet)
- `create` - Just contract creation (for checkout flows)
- `dashboard` - Just contract list (for merchant "My Sales" pages)

---

## Package 1: Shared API Proxy (YOU Host This)

### Purpose
Single server-side proxy that YOU run for ALL customers. Handles:
- User authentication (wallet signatures via SIWE)
- Cookie management (HttpOnly, SameSite)
- Request proxying to your backend services
- CORS for all merchant domains
- Rate limiting and abuse prevention

### Technology Stack
- **Runtime**: Node.js 20+ (Alpine Linux for Docker)
- **Framework**: Next.js 14 (API routes only, no frontend)
- **Deployment**: Docker container on YOUR infrastructure

### File Structure
```
conduit-shared-proxy/
├── package.json
├── Dockerfile
├── README.md
├── .env.template
├── next.config.js (minimal, API routes only)
├── pages/
│   └── api/
│       ├── auth/
│       │   ├── siwe/
│       │   │   ├── nonce.ts          # Get nonce for SIWE signing
│       │   │   ├── verify.ts         # Verify signature, create session
│       │   │   ├── session.ts        # Check existing session
│       │   │   └── signout.ts        # Clear session
│       │   ├── identity.ts           # Get current user data
│       │   └── update-email.ts       # Update user email
│       ├── chain/
│       │   ├── approve-usdc.ts       # USDC approval transactions
│       │   ├── deposit-funds.ts      # Fund escrow contracts
│       │   ├── transfer-usdc.ts      # Transfer USDC
│       │   ├── fund-wallet.ts        # Fund user wallet with gas
│       │   ├── claim-funds.ts        # Claim from expired contracts
│       │   ├── create-contract.ts    # Deploy contract to blockchain
│       │   └── contract/[contractAddress].ts  # Get contract data
│       ├── contracts/
│       │   ├── index.ts              # List/create pending contracts
│       │   ├── all.ts                # Get all user contracts
│       │   ├── deployed.ts           # Get deployed contracts
│       │   ├── [id]/
│       │   │   ├── index.ts          # Get/update contract
│       │   │   └── dispute.ts        # Raise dispute
│       │   └── deposit-notification.ts  # Notify of funding
│       ├── users/
│       │   ├── search.ts             # Search users
│       │   └── fid/[fid].ts          # Get user by Farcaster ID
│       └── config.ts                 # Get client configuration
├── utils/
│   ├── api-auth.ts                   # Auth validation helpers
│   └── cors.ts                       # CORS configuration
└── types/
    └── index.ts                      # TypeScript types
```

### Environment Variables
```bash
# Your Backend Services
USER_SERVICE_URL=https://backend.conduit-ucpi.com:8977
CHAIN_SERVICE_URL=https://backend.conduit-ucpi.com:8978
CONTRACT_SERVICE_URL=https://backend.conduit-ucpi.com:8080
PRODUCT_SERVICE_URL=https://backend.conduit-ucpi.com:8979

# Blockchain Configuration
CHAIN_ID=8453                         # Base mainnet
RPC_URL=https://mainnet.base.org
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CONTRACT_FACTORY_ADDRESS=0x...        # Your deployed factory

# CORS Configuration
ALLOWED_ORIGINS=*                     # Allow all, or comma-separated list
# ALLOWED_ORIGINS=https://shop1.com,https://shop2.com

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100    # Per IP address
RATE_LIMIT_ENABLED=true

# Node Environment
NODE_ENV=production
PORT=3000
```

### Key Features

#### 1. **User-Only Authentication with Recipient-Scoped Sessions**
```typescript
// pages/api/auth/siwe/verify.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { message, signature, recipient } = req.body;

  // Verify SIWE signature
  const user = await verifySignature(message, signature);

  // Create session with recipient context
  const session = {
    userWallet: user.walletAddress,
    currentRecipient: recipient,  // Store who they're paying
    expiresAt: Date.now() + 3600000 // 1 hour
  };

  // Set session cookie
  res.setHeader('Set-Cookie', createSessionCookie(session));
  res.json({ success: true, user });
}

// pages/api/contracts/index.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate user is authenticated
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const { sellerAddress } = req.body; // Recipient wallet

  // CRITICAL: Check if recipient matches session context
  if (session.currentRecipient !== sellerAddress) {
    // Recipient changed - require fresh signature
    return res.status(401).json({
      error: 'RECIPIENT_CHANGED',
      message: 'Please reconnect your wallet for this merchant'
    });
  }

  // Create contract with user-specified recipient
  const contract = {
    ...req.body,
    createdBy: session.userWallet,
    buyerAddress: session.userWallet,
    sellerAddress // Validated against session
  };

  // Forward to backend
  const response = await fetch(`${process.env.CONTRACT_SERVICE_URL}/api/contracts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Cookie': req.headers.cookie || ''
    },
    body: JSON.stringify(contract)
  });

  return res.status(response.status).json(await response.json());
}
```

**Widget UX Flow:**

1. **User on merchant-a.com:**
   - Connects wallet, signs message with recipient = "0xMerchantA"
   - Session created with `currentRecipient: "0xMerchantA"`
   - Can create contracts ✅

2. **User navigates to merchant-b.com:**
   - Widget loads, checks session
   - Session exists BUT `currentRecipient` is "0xMerchantA"
   - Widget detects mismatch, shows: "Connect wallet to pay 0xMerchantB..."
   - User clicks connect, signs NEW message with recipient = "0xMerchantB"
   - New session created with `currentRecipient: "0xMerchantB"`
   - Can create contracts ✅

**Security Benefits:**
- ✅ User must explicitly authenticate for each merchant
- ✅ Cannot accidentally pay wrong merchant
- ✅ Clear UX - user knows who they're paying
- ✅ No merchant registration system needed

#### 2. **Configuration Delivery**
```typescript
// pages/api/config.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Public endpoint, no auth required
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache

  res.json({
    chainId: parseInt(process.env.CHAIN_ID!),
    rpcUrl: process.env.RPC_URL!,
    usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS!,
    contractFactoryAddress: process.env.CONTRACT_FACTORY_ADDRESS!,
    explorerBaseUrl: process.env.EXPLORER_BASE_URL || 'https://basescan.org',
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID!
  });
}
```

**Widget fetches config on initialization:**
```javascript
// Widget init
async function init() {
  const config = await fetch('https://api.conduit-ucpi.com/api/config')
    .then(r => r.json());

  // Use config for Web3 initialization
  initializeWidget(config);
}
```

**No fallback config needed** - if API is down, widget cannot function anyway.

#### 3. **Universal CORS** (Allow All Origins)
```typescript
// utils/cors.ts
export function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;

  // Allow all origins, or validate against whitelist
  if (process.env.ALLOWED_ORIGINS === '*') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
```

#### 4. **Rate Limiting** (Prevent Abuse)
```typescript
// utils/rate-limiter.ts
const rateLimits = new Map<string, { count: number, resetAt: number }>();

export function checkRateLimit(ip: string, limit: number = 100): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }

  if (record.count >= limit) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}
```

**Note:** Rate limiting starts with simple IP-based approach (100 requests/minute). Can be enhanced post-launch if abuse is observed.

### Deployment

**Single Docker container:**
```bash
# Build
docker build -t conduit-shared-proxy .

# Run on YOUR infrastructure
docker run -d \
  -e USER_SERVICE_URL=https://backend.conduit-ucpi.com:8977 \
  -e CHAIN_SERVICE_URL=https://backend.conduit-ucpi.com:8978 \
  -e CONTRACT_SERVICE_URL=https://backend.conduit-ucpi.com:8080 \
  -e CHAIN_ID=8453 \
  -e RPC_URL=https://mainnet.base.org \
  -e USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  -e ALLOWED_ORIGINS=* \
  -p 3000:3000 \
  --restart unless-stopped \
  conduit-shared-proxy
```

**Deploy to your existing infrastructure:**
- Same server as backend services, or separate
- Load balancer in front (nginx/Caddy)
- SSL/TLS termination
- Health check endpoint: `/api/health`

### Security Features
- ✅ HTTPS only (enforce in production)
- ✅ HttpOnly cookies for session tokens
- ✅ Rate limiting per IP address
- ✅ Request validation and sanitization
- ✅ CORS configuration (allow all or whitelist)
- ✅ User authentication on every request

---

## Package 2: @conduit-ucpi/widget

### Purpose
Client-side JavaScript bundle that embeds **complete escrow management UI** into any website. Provides the full current webapp experience (dashboard, create, wallet management) in an embeddable widget.

### Technology Stack
- **Build Tool**: Vite (fast bundling, tree-shaking)
- **Framework**: React 19 (bundled, not peer dependency)
- **Styling**: Tailwind CSS (scoped to `.conduit-widget` to prevent conflicts)
- **Web3**: ethers.js + Reown AppKit (Web3Auth, WalletConnect, MetaMask)
- **Output Formats**:
  - UMD bundle (for `<script>` tags)
  - ESM bundle (for modern imports)
  - TypeScript definitions

### File Structure
```
@conduit-ucpi/widget/
├── package.json
├── vite.config.ts
├── README.md
├── src/
│   ├── index.ts                      # Main entry point (vanilla JS API)
│   ├── react.tsx                     # React component exports
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   └── EnhancedDashboard.tsx      # Full dashboard (from webapp)
│   │   ├── contracts/
│   │   │   ├── CreateContractWizard.tsx   # Contract creation flow
│   │   │   ├── EnhancedContractCard.tsx   # Contract display card
│   │   │   ├── ContractActions.tsx        # Fund/claim/dispute actions
│   │   │   ├── ContractDetailsModal.tsx   # Contract details modal
│   │   │   ├── DisputeManagementModal.tsx # Dispute handling
│   │   │   └── ContractAcceptance.tsx     # Accept/fund contracts
│   │   ├── auth/
│   │   │   ├── ConnectWalletEmbedded.tsx  # Wallet connection UI
│   │   │   └── SimpleAuthProvider.tsx     # Auth context
│   │   ├── wallet/
│   │   │   └── WalletView.tsx             # Wallet management
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       ├── Tabs.tsx
│   │       ├── StatsCard.tsx
│   │       ├── EmptyState.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ... (all UI components from webapp)
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── siwx-config.ts            # SIWX authentication
│   │   │   ├── BackendSIWXStorage.ts     # Session storage
│   │   │   └── BackendSIWXMessenger.ts   # Nonce fetching
│   │   ├── web3.ts                       # Blockchain operations
│   │   ├── api-client.ts                 # API calls to shared proxy
│   │   └── config.ts                     # Widget configuration
│   │
│   ├── utils/
│   │   ├── validation.ts                 # Input validation
│   │   ├── formatting.ts                 # Date/currency formatting
│   │   └── constants.ts                  # Constants
│   │
│   ├── types/
│   │   └── index.ts                      # TypeScript interfaces
│   │
│   └── styles/
│       └── widget.css                    # Scoped Tailwind CSS
│
├── dist/
│   ├── conduit-widget.umd.js            # UMD bundle
│   ├── conduit-widget.esm.js            # ESM bundle
│   ├── conduit-widget.css               # Styles
│   └── types/                           # TypeScript definitions
│
└── examples/
    ├── vanilla-html.html                # Vanilla JS integration
    ├── react-app/                       # React example
    ├── next-app/                        # Next.js example
    └── checkout-flow.html               # E-commerce checkout
```

### Widget Modes

#### **Mode 1: Full Platform** (Default)
```javascript
ConduitWidget.init({
  mode: 'full',
  containerId: 'conduit-escrow',
  theme: 'light'
});
```

**Shows:**
- ✅ Complete dashboard with stats
- ✅ Contract list (all contracts where user is buyer OR seller)
- ✅ Create new contract button
- ✅ Wallet connection
- ✅ Search and filtering
- ✅ All contract actions (fund, claim, dispute)

**Use case:** Merchant wants to offer full escrow platform to users

---

#### **Mode 2: Create Only** (Checkout Flow)
```javascript
ConduitWidget.init({
  mode: 'create',
  containerId: 'conduit-payment',
  defaultRecipient: '0xMerchantWallet...',  // Pre-filled
  amount: 99.99,                             // Pre-filled
  productName: 'Widget Starter Kit',        // Pre-filled
  expiryDays: 14,                            // Default
  onSuccess: function(contract) {
    console.log('Contract created:', contract.id);
    window.location.href = '/order-confirmation';
  }
});
```

**Shows:**
- ✅ Just the contract creation wizard
- ✅ Recipient pre-filled (merchant's wallet)
- ✅ Amount/product pre-filled (from order)
- ✅ Wallet connection if needed

**Use case:** E-commerce checkout, payment request forms

---

#### **Mode 3: Dashboard Only** (Merchant Sales View)
```javascript
ConduitWidget.init({
  mode: 'dashboard',
  containerId: 'conduit-sales',
  filter: 'seller',  // Only show where user is recipient
  theme: 'light'
});
```

**Shows:**
- ✅ Contract list filtered by role (buyer or seller)
- ✅ Stats cards
- ✅ Search and filtering
- ✅ Contract actions

**Use case:** Merchant "My Sales" page, buyer "My Purchases" page

---

### Integration Methods

#### **Method 1: Vanilla JavaScript (Script Tag)**
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.conduit-ucpi.com/widget/v1/conduit-widget.css">
</head>
<body>
  <h1>My Store Checkout</h1>
  <div id="conduit-payment"></div>

  <script src="https://cdn.conduit-ucpi.com/widget/v1/conduit-widget.umd.js"></script>
  <script>
    ConduitWidget.init({
      containerId: 'conduit-payment',
      mode: 'create',
      defaultRecipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: 99.99,
      productName: 'Website Design Service',
      theme: 'light',
      onSuccess: function(contract) {
        alert('Payment request created! Contract ID: ' + contract.id);
      }
    });
  </script>
</body>
</html>
```

---

#### **Method 2: React Component**
```jsx
import { ConduitProvider, ConduitDashboard, ConduitCreateContract } from '@conduit-ucpi/widget';
import '@conduit-ucpi/widget/dist/conduit-widget.css';

function App() {
  return (
    <ConduitProvider theme="light">
      <h1>Payment Portal</h1>

      {/* Full dashboard */}
      <ConduitDashboard />

      {/* Or just create contract */}
      <ConduitCreateContract
        defaultRecipient="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        amount={99.99}
        onSuccess={(contract) => {
          console.log('Contract created:', contract);
        }}
      />
    </ConduitProvider>
  );
}
```

---

#### **Method 3: Next.js Integration**
```jsx
// pages/checkout.tsx
import dynamic from 'next/dynamic';
import '@conduit-ucpi/widget/dist/conduit-widget.css';

// Dynamic import to avoid SSR issues
const ConduitCreateContract = dynamic(
  () => import('@conduit-ucpi/widget').then(mod => mod.ConduitCreateContract),
  { ssr: false }
);

export default function Checkout({ order }) {
  return (
    <div>
      <h1>Complete Your Order</h1>
      <ConduitCreateContract
        defaultRecipient={process.env.NEXT_PUBLIC_MERCHANT_WALLET}
        amount={order.total}
        productName={order.productName}
        onSuccess={(contract) => {
          // Mark order as paid
          fetch('/api/orders/' + order.id, {
            method: 'PATCH',
            body: JSON.stringify({ contractId: contract.id })
          });
        }}
      />
    </div>
  );
}
```

---

### API Surface

#### **Vanilla JS API**
```javascript
// Initialize widget
ConduitWidget.init({
  containerId: 'conduit-escrow',
  mode: 'full' | 'create' | 'dashboard',
  defaultRecipient: '0x...',     // Optional: pre-fill recipient
  amount: 99.99,                  // Optional: pre-fill amount
  productName: 'Product',         // Optional: pre-fill product
  expiryDays: 14,                 // Optional: default expiry
  theme: 'light' | 'dark',
  filter: 'all' | 'buyer' | 'seller',  // For dashboard mode
  onSuccess: (contract) => {},    // Contract created callback
  onError: (error) => {},         // Error callback
  onReady: () => {}              // Widget loaded callback
});

// Programmatic methods
ConduitWidget.disconnect();      // Disconnect wallet
ConduitWidget.destroy();         // Remove widget from DOM
ConduitWidget.refresh();         // Refresh contract list

// Event listeners
ConduitWidget.on('contract-created', (contract) => {});
ConduitWidget.on('contract-funded', (contract) => {});
ConduitWidget.on('wallet-connected', (address) => {});
ConduitWidget.on('wallet-disconnected', () => {});
```

---

#### **React Component API**
```jsx
import {
  ConduitProvider,
  ConduitDashboard,
  ConduitCreateContract,
  ConduitWallet,
  useConduitAuth,
  useConduitContracts
} from '@conduit-ucpi/widget';

// Provider (wraps entire widget)
<ConduitProvider
  theme="light|dark"
  onReady={() => {}}
  onError={(error) => {}}
>
  {/* Individual components */}
  <ConduitDashboard filter="all|buyer|seller" />

  <ConduitCreateContract
    defaultRecipient="0x..."
    amount={99.99}
    productName="Product"
    expiryDays={14}
    onSuccess={(contract) => {}}
    onError={(error) => {}}
  />

  <ConduitWallet />
</ConduitProvider>

// Hooks for advanced usage
function MyComponent() {
  const {
    user,
    isConnected,
    isAuthenticated,
    connect,
    disconnect
  } = useConduitAuth();

  const {
    contracts,
    isLoading,
    createContract,
    refreshContracts
  } = useConduitContracts();

  return <div>...</div>;
}
```

---

### Theming & Customization

#### **CSS Variables**
```css
:root {
  /* Colors */
  --conduit-primary: #3b82f6;
  --conduit-secondary: #8b5cf6;
  --conduit-success: #10b981;
  --conduit-error: #ef4444;
  --conduit-warning: #f59e0b;

  /* Backgrounds */
  --conduit-background: #ffffff;
  --conduit-surface: #f9fafb;
  --conduit-border: #e5e7eb;

  /* Text */
  --conduit-text-primary: #111827;
  --conduit-text-secondary: #6b7280;

  /* Spacing */
  --conduit-radius: 8px;
  --conduit-spacing: 16px;

  /* Typography */
  --conduit-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

#### **JavaScript Theme Configuration**
```javascript
ConduitWidget.init({
  theme: {
    mode: 'light', // or 'dark'
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      success: '#10b981',
      error: '#ef4444'
    },
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif'
  }
});
```

---

### Build Configuration

#### **Vite Config**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        main: resolve(__dirname, 'src/index.ts'),
        react: resolve(__dirname, 'src/react.tsx'),
      },
      name: 'ConduitWidget',
      formats: ['umd', 'es'],
      fileName: (format, entryName) =>
        `conduit-widget.${format}.js`
    },
    rollupOptions: {
      external: [], // Bundle everything (React included)
      output: {
        globals: {},
        assetFileNames: 'conduit-widget.[ext]'
      }
    },
    cssCodeSplit: false,
    minify: 'terser',
    sourcemap: true
  },
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer'),
        // Scope all Tailwind to .conduit-widget
        require('postcss-prefix-selector')({
          prefix: '.conduit-widget',
          transform: (prefix, selector) => {
            if (selector.includes(':root')) return selector;
            return `${prefix} ${selector}`;
          }
        })
      ]
    }
  }
});
```

### Bundle Size Targets
- **UMD Bundle**: ~800-1,200 KB gzipped (includes React, ethers, AppKit, full UI)
- **ESM Bundle**: ~600-900 KB gzipped (tree-shakeable)
- **CSS**: ~30-40 KB gzipped (scoped Tailwind)

**Why this is acceptable:**
- Same size as current webapp (already loading this much JavaScript)
- Only loads once, then cached by browser
- CDN edge caching makes subsequent loads instant
- Merchants using `/v1/` URL benefit from long cache headers (1 year)
- Modern users have fast connections (5G, fiber, cable)

**Optimization strategies:**
- Lazy load dashboard/wallet components (load on demand)
- Code splitting by route (create vs dashboard)
- Tree-shaking for unused components (ESM)
- Dynamic imports for Web3 libraries
- Aggressive CDN caching (CloudFlare worldwide edge servers)

### CDN Hosting & Versioning Strategy

**Semantic Versioning Approach:**

```
/widget/v1/                → Latest v1.x.x (auto minor/patch updates)
/widget/v1.2.3/            → Locked to specific version (never changes)
/widget/latest/            → Latest version period (dev/testing only)
```

**Version Management:**
- **Major versions (v1, v2)**: Breaking changes, new API surface
  - Supported for minimum 12 months after next major release
  - Merchants must manually upgrade URL
- **Minor versions (v1.1, v1.2)**: New features, backwards compatible
  - Auto-deployed to `/v1/` URL
  - Merchants using `/v1/` get updates automatically
- **Patch versions (v1.2.3, v1.2.4)**: Bug fixes only
  - Auto-deployed to `/v1/` and `/v1.2/` URLs
  - Critical security patches deployed immediately

**CDN Distribution:**
- **Primary**: CloudFlare CDN
  - `https://cdn.conduit-ucpi.com/widget/v1/`
- **Versioned**: Lock to specific version
  - `https://cdn.conduit-ucpi.com/widget/v1.2.3/`
- **Development**: Latest dev build
  - `https://cdn.conduit-ucpi.com/widget/dev/`
- **Fallback**: npm CDN (unpkg.com, jsdelivr.com)
  - `https://unpkg.com/@conduit-ucpi/widget@latest/dist/`

**Recommended merchant integration:**
```html
<!-- Production: Use major version for auto-updates -->
<script src="https://cdn.conduit-ucpi.com/widget/v1/conduit-widget.umd.js"></script>

<!-- Or pin to specific version for stability -->
<script src="https://cdn.conduit-ucpi.com/widget/v1.2.3/conduit-widget.umd.js"></script>
```

---

## Implementation Phases

### **Phase 1: Shared API Proxy** (Week 1-2)
**Goal**: Extract and deploy YOUR shared API proxy

#### Tasks:
1. **Create new directory**: `conduit-shared-proxy/`
2. **Copy API routes**: Extract all `/pages/api/**/*.ts` from webapp
3. **Remove frontend dependencies**: Strip out React components, pages
4. **Configure Next.js**: Minimal config for API routes only
5. **CORS configuration**: Allow all origins (or whitelist)
6. **Rate limiting**: Add per-IP rate limiting
7. **Docker setup**: Create Dockerfile
8. **Testing**:
   - Unit tests for each API route
   - Integration tests with backend services
   - Load testing (can handle 1000s of merchants)
9. **Deploy to YOUR infrastructure**:
   - Same VPS/cloud as backend, or separate
   - SSL/TLS via Let's Encrypt
   - Health monitoring
10. **Documentation**:
    - API endpoint documentation
    - Deployment guide
    - Troubleshooting guide

#### Deliverables:
- ✅ Working shared API proxy deployed at `api.conduit-ucpi.com`
- ✅ Docker image
- ✅ Deployment documentation
- ✅ Monitoring and logging setup

---

### **Phase 2: Widget Package - Core** (Week 3-5)
**Goal**: Create embeddable widget with dashboard + create functionality

#### Tasks:
1. **Create new directory**: `@conduit-ucpi/widget/`
2. **Setup Vite build**: Configure for UMD/ESM bundling
3. **Extract components**: Copy all components from webapp
   - Dashboard components
   - Contract creation wizard
   - Contract cards and actions
   - Auth components
   - UI components
4. **Create widget wrapper**:
   - `ConduitWidget.init()` vanilla JS API
   - Container mounting logic
   - Mode switching (full/create/dashboard)
5. **API client layer**:
   - Point to `api.conduit-ucpi.com`
   - Handle authentication
   - Error handling
6. **Styling isolation**:
   - Scope Tailwind to `.conduit-widget`
   - Prevent style conflicts
7. **Web3 integration**:
   - Bundle Reown AppKit
   - SIWE authentication
   - Wallet connection UI
8. **Testing**:
   - Component tests
   - Integration tests with shared proxy
   - Cross-browser testing
   - Mobile responsiveness
9. **Build optimization**:
   - Code splitting
   - Tree shaking
   - Minification
   - Lazy loading
10. **Documentation**:
    - Integration guide (vanilla JS)
    - API reference
    - Examples

#### Deliverables:
- ✅ UMD bundle (`conduit-widget.umd.js`)
- ✅ ESM bundle (`conduit-widget.esm.js`)
- ✅ CSS bundle (`conduit-widget.css`)
- ✅ Vanilla JavaScript integration working
- ✅ Full dashboard UI embedded
- ✅ Contract creation working
- ✅ Basic documentation

---

### **Phase 3: Widget Package - React Components** (Week 6)
**Goal**: Provide clean React component API

#### Tasks:
1. **Export React components**:
   - `<ConduitProvider>`
   - `<ConduitDashboard>`
   - `<ConduitCreateContract>`
   - `<ConduitWallet>`
2. **React hooks**:
   - `useConduitAuth()`
   - `useConduitContracts()`
   - `useConduitWallet()`
3. **TypeScript definitions**: Complete `.d.ts` files
4. **Testing**:
   - React Testing Library tests
   - Storybook for component documentation
5. **Examples**:
   - React app example
   - Next.js integration example
   - TypeScript example
6. **Documentation**:
   - React integration guide
   - Component prop documentation
   - Hooks API reference

#### Deliverables:
- ✅ React component exports
- ✅ TypeScript definitions
- ✅ React documentation
- ✅ Example React/Next.js apps

---

### **Phase 4: CDN & Distribution** (Week 7)
**Goal**: Set up CDN hosting and npm publishing

#### Tasks:
1. **CDN Setup**:
   - Configure CloudFlare CDN
   - Upload builds to CDN
   - Version management (v1/, v1.2.3/, dev/)
   - Cache headers (1 year for versioned, short for latest)
2. **npm Publishing**:
   - Publish to npm registry
   - Configure package.json for dual ESM/CJS
   - Set up automated releases (GitHub Actions)
3. **Fallback CDNs**:
   - unpkg.com configuration
   - jsdelivr.com configuration
4. **Monitoring**:
   - CDN analytics
   - Error tracking (Sentry)
   - Performance monitoring
5. **Documentation**:
   - CDN usage guide
   - Version migration guides
   - Changelog

#### Deliverables:
- ✅ Widget hosted on CDN
- ✅ npm package published
- ✅ Versioning strategy
- ✅ Analytics and monitoring

---

### **Phase 5: Documentation & Examples** (Week 8)
**Goal**: Comprehensive documentation and integration examples

#### Tasks:
1. **Documentation Site**:
   - Getting started guide
   - API reference
   - Component documentation
   - Theming guide
   - Troubleshooting guide
   - FAQ
2. **Integration Examples**:
   - Vanilla HTML example
   - React example
   - Next.js example
   - E-commerce checkout flow
   - Marketplace integration
   - Freelance payment portal
3. **Video Tutorials**:
   - 5-minute quick start
   - Full integration walkthrough
   - Customization tutorial
4. **Interactive Demos**:
   - Live widget playground
   - Theme customizer
   - Code generator
5. **Migration Guides**:
   - From standalone webapp to widget
   - Version upgrade guides

#### Deliverables:
- ✅ Complete documentation site
- ✅ Multiple integration examples
- ✅ Video tutorials
- ✅ Interactive demos

---

### **Phase 6: Testing & Refinement** (Week 9)
**Goal**: Production-ready quality assurance

#### Tasks:
1. **End-to-End Testing**:
   - Full user flows (connect → create → fund → claim)
   - Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - Mobile testing (iOS Safari, Android Chrome)
   - Accessibility testing (WCAG 2.1)
2. **Performance Testing**:
   - Load time benchmarks
   - Widget initialization speed
   - API response times
   - Stress testing shared proxy
3. **Security Audit**:
   - XSS prevention verification
   - CSRF protection testing
   - Cookie security review
   - Dependency vulnerability scanning
   - SIWE implementation review
4. **User Testing**:
   - Internal testing with team
   - External beta testers (3-5 friendly merchants)
   - Collect feedback on integration difficulty
   - Identify pain points
5. **Bug Fixes**:
   - Address all critical bugs
   - Fix integration issues
   - Polish UI/UX based on feedback

#### Deliverables:
- ✅ Complete test coverage
- ✅ Security audit report
- ✅ Performance benchmarks
- ✅ Beta feedback report
- ✅ Bug fixes implemented

---

### **Phase 7: Beta Launch** (Week 10)
**Goal**: Launch to 3-5 beta customers

#### Tasks:
1. **Beta Customer Selection**:
   - 1-2 e-commerce sites
   - 1 marketplace
   - 1 freelance platform
   - Diverse use cases
2. **White-Glove Onboarding**:
   - Direct integration support
   - Custom configuration help
   - Slack/Discord support channel
3. **Monitoring**:
   - Real-time error tracking
   - Usage analytics
   - Performance monitoring
4. **Feedback Collection**:
   - Weekly check-ins
   - Integration difficulty survey
   - Feature requests
   - Bug reports
5. **Iteration**:
   - Quick bug fixes
   - Documentation improvements
   - UI/UX refinements

#### Deliverables:
- ✅ 3-5 beta customer integrations
- ✅ Feedback report
- ✅ Iteration plan
- ✅ Updated documentation

---

### **Phase 8: Public Launch** (Week 11-12)
**Goal**: Public release and marketing

#### Tasks:
1. **Final Polish**:
   - Address all beta feedback
   - Performance optimizations
   - Security hardening
   - Documentation finalization
2. **Marketing Materials**:
   - Landing page
   - Product demo video
   - Case studies (beta customers)
   - Blog post announcement
   - Social media assets
3. **Launch**:
   - Product Hunt launch
   - Hacker News post
   - Twitter/X announcement
   - Reddit (r/webdev, r/entrepreneur)
   - Email to waitlist
4. **Support Infrastructure**:
   - Support email/tickets
   - Community Discord/forum
   - Documentation site live
5. **Post-Launch Monitoring**:
   - Track signups
   - Monitor integration success rate
   - Quick response to issues
   - Collect testimonials

#### Deliverables:
- ✅ Production-ready SDK
- ✅ Marketing website
- ✅ Support infrastructure
- ✅ Public announcement
- ✅ Initial customer traction

---

## Merchant Integration Journey

### **Step 1: Discovery**
Merchant finds widget via:
- Landing page
- Product demo
- Case study
- Word of mouth

### **Step 2: Try It** (5 minutes)
```html
<!-- Copy/paste from documentation -->
<script src="https://cdn.conduit-ucpi.com/widget/v1/conduit-widget.umd.js"></script>
<div id="conduit-escrow"></div>
<script>
  ConduitWidget.init({
    mode: 'create',
    defaultRecipient: 'THEIR_WALLET_ADDRESS'
  });
</script>
```

**No signup. No API keys. Just works.**

### **Step 3: Test Transaction**
- Connect wallet (MetaMask, WalletConnect, etc.)
- Create test contract
- Fund with USDC
- See it on blockchain

### **Step 4: Go Live**
- Copy code to production site
- Change recipient address to production wallet
- Deploy

### **Step 5: (Optional) Advanced Features**
If merchant wants:
- Email notifications → Sign up for account
- Webhooks → Configure in dashboard
- Analytics → View in merchant portal
- Custom branding → Premium tier

---

## Pricing Strategy (Optional for Later)

### **Free Forever Tier**
- ✅ Unlimited contracts
- ✅ Full widget functionality
- ✅ Community support (docs, Discord)
- ✅ No signup required

**Revenue model:** Transaction fees on blockchain (if you implement)

---

### **Premium Tier** ($29-99/month) - OPTIONAL
If you add merchant accounts later:
- ✅ Everything in Free
- ✅ Email notifications
- ✅ Webhook integrations
- ✅ Analytics dashboard
- ✅ Custom branding
- ✅ Priority support

---

### **Enterprise Tier** ($499+/month) - OPTIONAL
For large merchants:
- ✅ Everything in Premium
- ✅ Dedicated account manager
- ✅ Custom integrations
- ✅ SLA guarantees
- ✅ White-label option

---

## Success Metrics

### **Technical Performance**
- **Widget Load Time**: <2 seconds on 3G
- **API Response Time**: <200ms average
- **Uptime**: 99.9%
- **Error Rate**: <0.1%

### **Developer Experience**
- **Time to First Contract**: <10 minutes
- **Integration Difficulty**: 90%+ can integrate without support
- **Documentation Quality**: <5% support tickets about setup

### **Business Metrics**
- **Beta Customers**: 5 integrations within 30 days
- **Public Launch**: 50 integrations in first month
- **Activation Rate**: 70%+ of trials go to production

---

## Risk Mitigation

### **Risk 1: Bundle Size Too Large**
**Mitigation:**
- Lazy load components (load dashboard only when needed)
- Code splitting by route
- Tree-shaking for ESM bundle
- CDN with aggressive caching

### **Risk 2: Shared Proxy Becomes Bottleneck**
**Mitigation:**
- Horizontal scaling (multiple proxy instances)
- Load balancer in front
- Caching layer (Redis)
- Monitor and scale proactively
- Accept that proxy downtime = widget downtime (no fallback needed)
- Focus on high availability through redundancy rather than complex fallback logic

### **Risk 3: Rate Limiting & Abuse**
**Mitigation:**
- Start with simple IP-based rate limiting (100 req/min)
- Monitor for abuse patterns
- Can enhance to wallet-based or tiered limits if needed
- Recipient-scoped sessions prevent payment to wrong merchant
- User must explicitly re-authenticate when recipient changes

### **Risk 4: Web3Auth/AppKit Outage**
**Mitigation:**
- Support multiple auth providers
- Fallback to direct MetaMask connection
- Graceful degradation
- Monitor auth provider status

### **Risk 5: Breaking Changes in Backend**
**Mitigation:**
- API versioning in backend services
- Maintain backward compatibility for 6 months
- Deprecation warnings in widget
- Clear migration guides
- Beta testing before releases

---

## Next Steps

1. **Review this plan** - Confirm approach aligns with goals
2. **Confirm timeline** - Is 12 weeks realistic? Need more/less time?
3. **Assign resources** - Who works on what?
4. **Start Phase 1** - Extract and deploy shared API proxy

---

## Summary

This plan transforms the Conduit UCPI webapp into an **embeddable SDK** with:

**Core Simplifications:**
- ✅ **No merchant API keys** - Wallet address is the merchant identifier
- ✅ **No merchant accounts** - Optional feature for later
- ✅ **No customer deployment** - You host the shared API proxy
- ✅ **No authentication complexity** - User wallet signatures only

**Core Features:**
- ✅ **Complete dashboard UI** - Full current webapp embedded
- ✅ **Contract creation** - Pre-fillable for merchant checkout
- ✅ **Wallet management** - Built-in Web3 auth
- ✅ **All contract actions** - Fund, claim, dispute

**Integration:**
- ✅ **3 lines of code** - `<script>` tag + `init()`
- ✅ **Zero configuration** - Works immediately
- ✅ **Multiple modes** - Full, create-only, dashboard-only
- ✅ **React support** - Optional component library

**Timeline**: 12 weeks from start to public launch (aggressive but achievable)
**Effort**: 1-2 developers full-time
**Outcome**: Production-ready embeddable escrow platform

**Timeline Notes:**
- 12 weeks is aggressive but accepted
- Focus on shipping quickly, iterating based on real usage
- May launch with some rough edges, polish post-launch
- Prioritize core functionality over perfection
