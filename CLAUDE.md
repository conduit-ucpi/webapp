# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Conduit UCPI Web3 SDK webapp - a Next.js frontend application for creating and managing time-delayed escrow contracts on Avalanche. The application uses minimal backend services, primarily serving as a static frontend with API routes that proxy to Kotlin microservices.

## Technology Stack

- **Framework**: Next.js 14 with Pages Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: Web3Auth Modal SDK + ethers.js
- **Payments**: MoonPay SDK for USDC purchases
- **UI Components**: Custom components built with Headless UI

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server  
npm start

# Run type checking
npm run type-check

# Run linting
npm run lint
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `WEB3AUTH_CLIENT_ID`: Web3Auth project client ID
- `CHAIN_ID`: Avalanche testnet (43113) or mainnet (43114)  
- `RPC_URL`: Avalanche RPC endpoint
- `USDC_CONTRACT_ADDRESS`: USDC contract address on Avalanche
- `CONTRACT_FACTORY_ADDRESS`: Your deployed escrow factory contract
- `MOONPAY_API_KEY`: MoonPay API key for USDC purchases
- `USER_SERVICE_URL`: Backend user service endpoint (default: http://localhost:8977)
- `CHAIN_SERVICE_URL`: Backend chain service endpoint (default: http://localhost:8978)

## Architecture Overview

### Authentication Flow
1. Runtime config fetched from `/api/config` on app startup
2. Web3Auth Modal handles wallet connection and authentication
3. API route `/api/auth/login` proxies to UserService with idToken and walletAddress
4. UserService returns user data and sets http-only auth cookies
5. Auth state managed via React context providers

### Contract Interaction
- Web3 operations use ethers.js with signed transactions
- Frontend signs transactions, backend submits them via Chain Service
- USDC approval/transfer flow handled automatically
- Contract states: active, expired, disputed, resolved, completed

### API Routes (Proxy Pattern)
All `/api/*` routes proxy requests to backend microservices with cookie forwarding:
- `/api/auth/*` → User Service authentication endpoints
- `/api/chain/*` → Chain Service contract operations  
- `/api/config` → Returns client-side configuration

### Key Components Structure
```
components/
├── auth/           # Web3Auth integration and context providers
├── contracts/      # Contract creation, display, and management
├── layout/         # Header, footer, and layout components  
├── moonpay/        # MoonPay widget integration
└── ui/             # Reusable UI components (Button, Input, Modal, etc.)

pages/
├── index.tsx       # Landing page with hero and features
├── create.tsx      # Contract creation form  
├── dashboard.tsx   # User contract management dashboard
├── buy-usdc.tsx    # MoonPay USDC purchase flow
└── api/            # Next.js API routes (all proxy to backend)
```

### State Management
- Auth state: React Context (`AuthProvider`)
- Config state: React Context (`ConfigProvider`) 
- Contract state: Local component state with API calls
- No global state management library - keeping it simple

## Key Files

- `lib/web3.ts`: Web3Service class for blockchain interactions
- `utils/validation.ts`: Input validation and formatting utilities
- `types/index.ts`: TypeScript interfaces for the application
- `components/auth/ConnectWallet.tsx`: Web3Auth integration component

## Development Notes

- Uses Pages Router (not App Router) as specified
- All backend communication via http-only cookies for security
- Web3 transactions are signed client-side, submitted server-side
- MoonPay widget loads dynamically to avoid bundle size issues
- Auto-refresh dashboard every 30s for contracts near expiry
- Responsive design with mobile-first Tailwind approach

## Testing

No test framework configured yet. When adding tests:
- Use Jest + React Testing Library for unit/integration tests
- Mock Web3Auth and blockchain interactions
- Test API routes with mock fetch responses
- Consider Playwright for E2E testing critical user flows