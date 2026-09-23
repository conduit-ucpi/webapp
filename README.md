# Conduit UCPI Web3 SDK - Frontend

A Next.js web application for creating and managing time-delayed escrow contracts on EVM-compatible blockchains (Base, Avalanche, Ethereum, etc.).

## Features

- **Multi-Wallet Support**: Dynamic.xyz SDK (recommended), Farcaster Frames, WalletConnect, and Web3Auth
- **Mobile-First Design**: Optimized wallet connections that work seamlessly on mobile devices
- **Secure Authentication**: Wallet-based login with signature verification and JWT tokens
- **Time-Delayed Escrow**: Create escrow agreements with configurable time locks and dispute resolution
- **Multi-Token Support**: USDC and USDT with extensible token system
- **USDCBAY Marketplace**: Integrated e-commerce platform with crypto buyer protection
- **Farcaster Integration**: Frame-based authentication for social commerce
- **Real-time Updates**: Auto-refreshing dashboard for contract status changes
- **Responsive UI**: Optimized for desktop, tablet, and mobile devices
- **Gas Abstraction**: Server pays gas fees - users only sign transactions

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration (see Configuration section)
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: ethers.js v6
- **Wallet Solutions**:
  - **Dynamic.xyz SDK** (recommended - excellent mobile support, MetaMask compatible)
  - **Farcaster SDK** (@farcaster/frame-sdk - social frames)
  - **WalletConnect/Reown** (wallet connect protocol)
  - **Web3Auth Modal SDK** (legacy - has mobile MetaMask issues)
- **UI Components**: Headless UI, custom components
- **State Management**: React Context API
- **Payments**: MoonPay SDK (coming soon)
- **Testing**: Jest + React Testing Library

## Configuration

### Environment Variables

The app requires extensive configuration. See `.env.example` for the complete list. Key variables:

#### Blockchain Configuration
```bash
CHAIN_ID=84532                    # Base Sepolia testnet
RPC_URL=https://sepolia.base.org  # Base Sepolia RPC
USDC_CONTRACT_ADDRESS=0x...       # USDC token address
USDT_CONTRACT_ADDRESS=0x...       # USDT token address
DEFAULT_TOKEN_SYMBOL=USDC         # Default token to use
CONTRACT_FACTORY_ADDRESS=0x...    # Deployed factory contract
```

#### Backend Services
```bash
USER_SERVICE_URL=http://localhost:8977      # Authentication service
CHAIN_SERVICE_URL=http://localhost:8978     # Blockchain relay service
CONTRACT_SERVICE_URL=http://localhost:8080  # Contract management service
DISPUTE_SERVICE_URL=http://localhost:8981   # Arbiter service (admin routes under /api/admin/disputes)
X_API_KEY=your_chain_service_api_key_here   # Chain service API key
```

#### Farcaster Integration
```bash
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_API_URL=https://api.neynar.com/v2/farcaster
```

#### Application Settings
```bash
NEXT_PUBLIC_BASE_PATH=null        # Set to 'null' for local dev
COOKIE_DOMAIN=localhost           # Cookie domain for auth
SERVICE_LINK=http://localhost:3000
PRODUCT_NAME=Conduit UCPI
MIN_GAS_WEI=5                     # Minimum gas price for testnets
```

#### Optional Configuration
```bash
MOONPAY_API_KEY=your_moonpay_api_key_here
NEXT_PUBLIC_REDDIT_PIXEL_ID=your_reddit_pixel_id_here
ALLOWED_FRAME_ANCESTORS=https://*.example.com  # CSP frame ancestors
```

See `.env.example` for all 40+ configuration options.

## Architecture

### Overview

This is a frontend application that proxies API calls to backend microservices while handling wallet connections and transaction signing client-side.

### Wallet Connection Architecture

The application supports multiple wallet providers through a unified authentication system:

#### 1. Dynamic.xyz (Recommended)
- **Best mobile support** - works perfectly with MetaMask mobile
- **Multi-wallet** - supports 300+ wallets including MetaMask, Coinbase, WalletConnect
- **Social login** - email, Google, Twitter, Discord
- **Embedded wallets** - create wallets for users without existing wallets
- **Implementation**: `components/auth/DynamicWrapper.tsx`

#### 2. Farcaster Frames
- **Social commerce** - authenticate via Farcaster social graph
- **Frame SDK** - embedded in Warpcast and other Farcaster clients
- **Use case** - USDCBAY marketplace embedded in social feeds
- **Implementation**: `components/auth/farcasterAuth.tsx`

#### 3. WalletConnect/Reown
- **Protocol standard** - connects to mobile wallets via QR code
- **Cross-platform** - works with most mobile wallet apps
- **Implementation**: `components/auth/reownWalletConnect.tsx`

#### 4. Web3Auth (Legacy)
- **Legacy support** - maintained for backward compatibility
- **Known issues** - doesn't work well with mobile MetaMask
- **Being phased out** - use Dynamic.xyz instead
- **Implementation**: Web3Auth Modal SDK direct integration

### Authentication Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  Wallet Provider Selection      │
│  (Dynamic/Farcaster/WalletConnect) │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Connect Wallet + Sign Message  │
│  (Client-side, private key safe)│
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  POST /api/auth/login           │
│  (idToken + signature)          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  web3userservice                │
│  - Validates signature          │
│  - Creates JWT token            │
│  - Sets HTTP-only cookie        │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Authenticated Session          │
│  (Cookie-based for web,         │
│   Bearer token for frames)      │
└─────────────────────────────────┘
```

### Transaction Flow

```
┌──────────────┐
│   Frontend   │ Signs transaction (client-side)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  API Route   │ Forwards to backend + auth token
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ chainservice │ Pays gas, submits to blockchain
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Blockchain  │ Executes contract
└──────────────┘
```

### Backend Services

The frontend requires these microservices (see main CLAUDE.md for details):

| Service | Port | Purpose |
|---------|------|---------|
| **web3userservice** | 8977 | User authentication, JWT management, wallet verification |
| **chainservice** | 8978 | Blockchain relay, gas payment, contract queries |
| **contractservice** | 8080 | Pending contract management (MongoDB) |
| **productservice** | 8979 | USDCBAY marketplace catalog (MongoDB) |
| **emailservice** | 8976 | Transactional email notifications |

All services communicate via REST APIs with JWT authentication.

### Key Components

```
components/
├── auth/
│   ├── DynamicWrapper.tsx         # Dynamic.xyz integration
│   ├── farcasterAuth.tsx          # Farcaster frame auth
│   ├── reownWalletConnect.tsx     # WalletConnect protocol
│   ├── SimpleAuthProvider.tsx     # Unified auth context
│   ├── backendAuth.ts             # Backend API client
│   └── ConfigProvider.tsx         # Runtime config
├── contracts/
│   ├── ContractForm.tsx           # Contract creation UI
│   ├── ContractCard.tsx           # Contract display
│   └── DisputeModal.tsx           # Dispute handling
└── ui/
    ├── Button.tsx                 # Reusable button
    ├── Modal.tsx                  # Modal dialogs
    └── USDCGuide.tsx              # Token setup guide

pages/
├── index.tsx                      # Landing page
├── dashboard.tsx                  # Contract management
├── contract-create.tsx            # Create new contract
├── wallet.tsx                     # Wallet info
└── api/                           # Backend proxy routes
    ├── auth/                      # Authentication
    ├── chain/                     # Blockchain operations
    ├── contracts/                 # Contract management
    └── config.ts                  # Client config endpoint

lib/
├── auth/
│   ├── core/                      # AuthManager, ProviderRegistry
│   ├── providers/                 # Provider implementations
│   ├── backend/                   # BackendClient
│   └── react/                     # React context/hooks
├── web3.ts                        # Web3Service (blockchain ops)
├── dynamicConfig.ts               # Dynamic.xyz configuration
└── constants.ts                   # App constants

utils/
├── validation.ts                  # Input validation
├── formatting.ts                  # Data formatting
└── api-auth.ts                    # API authentication helpers
```

## Development

### Available Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run type-check       # TypeScript type checking
npm run lint             # ESLint
npm run build            # Production build
npm start                # Start production server

# Testing
npm test                           # Run all tests
npm test -- path/to/file.test.tsx  # Run specific test
npm run test-api-conformance       # Validate API calls against backend docs

# Environment
npm run env:check        # Validate environment variables (if implemented)
```

### Development Workflow

1. **Make code changes**
2. **Run type check**: `npm run type-check`
3. **Run tests**: `npm test`
4. **Test manually**: `npm run dev`
5. **Commit changes**: Use descriptive commit messages
6. **Push to branch**: Never push directly to `main`

### Testing

The app has comprehensive test coverage:

- **Unit tests**: Component and utility function tests
- **Integration tests**: API route and authentication flow tests
- **Architecture tests**: Ensure proper abstraction boundaries
- **API conformance tests**: Validate calls match backend OpenAPI specs

```bash
# Run all 691+ tests
npm test

# Run specific test suites
npm test -- __tests__/components/
npm test -- __tests__/api/
npm test -- __tests__/lib/

# Run with coverage
npm test -- --coverage
```

### File Structure

```
webapp/
├── .github/
│   └── workflows/           # GitHub Actions CI/CD
├── components/              # React components
├── pages/                   # Next.js pages
├── lib/                     # Core libraries
├── utils/                   # Utility functions
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript types
├── public/                  # Static assets
├── __tests__/              # Test files (mirrors src structure)
├── .env.example            # Environment variable template
├── CLAUDE.md               # Claude Code agent instructions
├── tsconfig.json           # TypeScript config
├── tailwind.config.js      # Tailwind CSS config
├── next.config.js          # Next.js config
└── package.json            # Dependencies
```

## Deployment

### GitHub Actions CI/CD Pipeline

Deployment is automated via GitHub Actions:

1. **Commit changes** to your feature branch
2. **Merge to main** after review
3. **Push main to remote**: `git push origin main`
4. **Merge main → build-test**: For test environment deployment
   ```bash
   git checkout build-test
   git merge main
   git push origin build-test
   ```
5. **GitHub Actions triggers**:
   - Builds Docker image
   - Pushes to GitHub Container Registry (ghcr.io)
   - Deploys to GCP VM
   - Updates running container

6. **Merge main → build-production**: For production deployment
   ```bash
   git checkout build-production
   git merge main
   git push origin build-production
   ```

### Environment Variables in CI/CD

When adding new environment variables:

1. **Add to code**: Update `.env.example` and your code
2. **Add to GitHub**: Repository Settings → Secrets and variables → Actions
3. **Add to workflow**: Update `.github/workflows/*.yml` to pass variable to Docker
4. **Deploy**: Push to build-test/build-production to apply changes

### Docker Deployment

- **Base image**: Node.js with Next.js standalone build
- **Static files**: GitHub Actions copies `public/` to `.next/standalone/`
- **Runtime**: Docker container on GCP VM
- **Reverse proxy**: Caddy handles TLS and routing
- **No local runs**: All testing must be done in deployed environments

### Deployment Checklist

- [ ] All tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Environment variables added to GitHub secrets
- [ ] GitHub Actions workflow updated if needed
- [ ] Changes committed with descriptive message
- [ ] Deployed to build-test first
- [ ] Manually tested in test environment
- [ ] Only then deploy to build-production

## Security

### Authentication Security

- **Private keys never leave client** - all signing is client-side
- **HTTP-only cookies** - auth tokens not accessible to JavaScript
- **JWT tokens** - signed with strong secrets, short expiration
- **Signature verification** - wallet ownership verified on backend
- **CORS protection** - restricted origins for API calls

### Transaction Security

- **Client-side signing** - transactions signed by user's wallet
- **Server-side gas payment** - backend pays gas fees
- **Signature verification** - backend validates signatures before submission
- **No private key storage** - keys remain in user's wallet
- **HTTPS only** - all communication encrypted in production

### Data Security

- **Input validation** - all user inputs validated and sanitized
- **SQL injection protection** - MongoDB with parameterized queries
- **XSS protection** - React escapes outputs by default
- **Environment variables** - sensitive config never committed
- **Secrets management** - GitHub secrets for CI/CD

### Security Best Practices

- Never log bearer tokens, cookies, or headers (see recent security fix)
- Never commit `.env.local` or log files
- Rotate secrets regularly
- Use different secrets for test and production
- Monitor for unusual activity

## Troubleshooting

### Common Issues

**Wallet won't connect on mobile**
- Ensure `WALLETCONNECT_PROJECT_ID` is set correctly
- Test with MetaMask mobile app or other mobile wallets

**Authentication fails**
- Check `USER_SERVICE_URL` is correct
- Verify JWT secrets match across services
- Check browser console for errors
- Ensure cookies are enabled

**Transactions fail**
- Verify `CHAIN_SERVICE_URL` is accessible
- Check `CHAIN_ID` matches your RPC endpoint
- Ensure contract addresses are correct
- Check user has approved token spending

**Build fails**
- Run `npm run type-check` to find TypeScript errors
- Check `.env.example` for missing variables
- Ensure all dependencies are installed

**Tests fail**
- Check test logs for specific failures
- Run `npm test -- path/to/failing/test.tsx` for details
- Ensure mocks are properly configured

### Debug Mode

Enable detailed logging by setting:
```bash
NODE_ENV=development
```

Check browser console and server logs for detailed error messages.

## API Documentation

Frontend API routes proxy to backend services:

- `/api/auth/*` → User Service (authentication)
- `/api/chain/*` → Chain Service (blockchain operations)
- `/api/contracts/*` → Contract Service (contract management)
- `/api/config` → Runtime configuration endpoint

See backend service repositories for detailed API documentation.

## Contributing

### Development Guidelines

1. **Follow existing patterns** - maintain consistency with codebase
2. **Write tests** - all new features and bug fixes need tests
3. **Type everything** - use TypeScript types, avoid `any`
4. **Validate inputs** - use validation utilities from `utils/validation.ts`
5. **Handle errors** - proper error messages and user feedback
6. **Document changes** - update CLAUDE.md if architecture changes

### Commit Message Format

```
CATEGORY: Brief description of change

Detailed explanation of what changed and why.
Include technical details and context.

Testing:
- Describe how you tested
- List any new tests added

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Categories: FEATURE, FIX, REFACTOR, SECURITY, DOCS, TEST, CHORE

## License

MIT License - see LICENSE file for details

---

**For detailed architecture and agent instructions, see [CLAUDE.md](CLAUDE.md)**

Built for secure Web3 transactions
