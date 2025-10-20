# CLAUDE.md

# ⚠️ CRITICAL RULES - READ BEFORE EVERY ACTION ⚠️

1. **NEVER DUPLICATE LOGIC** - If a function exists, USE IT, don't recreate it
2. **SINGLE SOURCE OF TRUTH** - Always use existing validation/logic functions  
3. **READ THE ENTIRE CODEBASE** before creating new functions
4. **SEARCH FOR EXISTING SOLUTIONS** before writing new code
5. **No provider or context specific code should leak beyond the boundary of the interfaces** - the main app code should just use the generic interfaces not worry about farcaster vs. web3auth

## 🛑 STOP - CHECKLIST BEFORE CODING 🛑
- [ ] Did I search for existing functions that do this?
- [ ] Am I about to duplicate existing logic?
- [ ] Can I use an existing single source of truth?
- [ ] Have I read the validation.ts file completely?
- [ ] Did I grep for similar function names?
- [ ] Am I creating parallel code that will cause inconsistencies?

## Before writing ANY new function:
1. **ALWAYS** Grep for similar function names first
2. **ALWAYS** Check if the logic already exists elsewhere  
3. **ALWAYS** Use existing functions instead of duplicating
4. **NEVER** create a second function that does the same thing
5. **READ** utils/validation.ts completely before creating validation logic

## CRITICAL: Repository Boundaries

This Claude agent is **STRICTLY LIMITED** to the webapp directory (`/Users/charliep/conduit-ucpi/webapp`). 

### Agent Restrictions
- **NEVER navigate to or modify files outside this directory**
- **NEVER access parent directories** (../)
- **NEVER modify files in sibling services**
- **ONLY work within**: `/Users/charliep/conduit-ucpi/webapp`

### Working Directory
Your working directory is: `/Users/charliep/conduit-ucpi/webapp`
All file operations must be relative to this directory or use absolute paths within it.

### Integration Guidelines
When changes require updates to other services:
1. Document the required changes clearly
2. Return to the parent orchestrator agent
3. Let the parent agent delegate to the appropriate service agent

If asked to modify files outside this directory, respond:
"I cannot modify files outside the webapp directory. Please use the parent orchestrator agent to coordinate changes across multiple services."

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
- `MIN_GAS_WEI`: Minimum gas price in wei for testnet transactions (default: 5)

## Architecture Overview

### Authentication Flow
1. Runtime config fetched from `/api/config` on app startup
2. Web3Auth Modal handles wallet connection and authentication
3. API route `/api/auth/login` proxies to UserService with idToken and walletAddress
4. **ALL authentication verification is handled by web3userservice** - the webapp only proxies requests
5. UserService validates tokens, returns user data and sets http-only auth cookies
6. Auth state managed via React context providers (no local auth validation)

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
├── moonpay/        # MoonPay widget integration (currently in "coming soon" mode)
└── ui/             # Reusable UI components (Button, Input, Modal, USDCGuide, etc.)

pages/
├── index.tsx       # Landing page with hero and features
├── create.tsx      # Contract creation form  
├── dashboard.tsx   # User contract management dashboard
├── buy-usdc.tsx    # MoonPay USDC purchase flow (displays "coming soon" message)
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
- `components/ui/USDCGuide.tsx`: Reusable guide for adding USDC to wallet (used in wallet and buy-usdc pages)

## Development Notes

- Uses Pages Router (not App Router) as specified
- All backend communication via http-only cookies for security
- Web3 transactions are signed client-side, submitted server-side
- MoonPay widget loads dynamically to avoid bundle size issues (currently disabled with "coming soon" message)
- Auto-refresh dashboard every 30s for contracts near expiry
- Responsive design with mobile-first Tailwind approach
- Always favour code re-use
- Always avoid hard-coding

## Testing

No test framework configured yet. When adding tests:
- Use Jest + React Testing Library for unit/integration tests
- Mock Web3Auth and blockchain interactions
- Test API routes with mock fetch responses
- Consider Playwright for E2E testing critical user flows

**Testing Requirements:**
- **CRITICAL**: A coding task is NOT complete until tests are written and pass
- Must run `npm test` successfully after any code changes (once test framework is set up)
- All new functionality and bug fixes require test coverage

**Git Commit Requirements:**
- **All git commit messages must be useful and descriptive**
- Explain what was changed and why, not just what files were touched
- Use present tense and imperative mood ("Add validation" not "Added validation")
- Include context about the business impact when relevant
- Avoid generic messages like "fix", "update", or "changes"

## Deployment

- happens via github actions
- controlled by yml files in .github/workflows
- yml files pull all the environment variables from github and put them in the build and the docker containers that are deployed - so when we add environment variables, we need to make sure they are added to the yml config for github actions

### Docker Build Process
- Uses Next.js standalone build for minimal container size
- GitHub Actions builds the app then copies static assets to `.next/standalone/`
- **IMPORTANT**: Static files (`public/` folder) are copied by GitHub workflow to `.next/standalone/public/`
- Dockerfile copies the entire `.next/standalone/` directory (which includes public files)
- When adding new images/static files to `public/`, they must be:
  1. Committed to git
  2. Pushed to build-test branch to trigger new deployment
  3. GitHub workflow will copy them to standalone build and include in Docker container

### Static File Handling
- Images in `public/` folder are accessible at `/filename.png` in production
- GitHub workflow includes debugging to verify static files are copied correctly
- If images don't load after deployment, check GitHub Actions logs for copy errors

## Inter-Service Communication Standards

### DateTime Format
- **ALL datetime communication between services MUST use Unix timestamp format (seconds since epoch)**
- **ALL datetime internal representations MUST be use Unix timestamp**
- **Examples**: `expiryTimestamp: 1735689600`, `createdAt: 1705318200`
- **No exceptions**: ISO strings, formatted dates, or milliseconds
- **ALL datetimes displayed to users MUST use the `formatDateTimeWithTZ()` function**
- **FORBIDDEN**: Never use `.toISOString()`, `.toLocaleDateString()`, `.toLocaleString()`, `formatDate()`, `formatDateTime()`, or any other datetime formatting methods for user displays
- **The `formatDateTimeWithTZ()` function outputs ISO strings with timezone (e.g., "2024-01-15T14:30:00-05:00")**

### Currency Format  
- **ALL currency amounts between services MUST be in microUSDC**
- **ALL internal representations of currency MUST be in microUSDC**
- **microUSDC = USDC × 1,000,000** (6 decimal places)
- **Examples**: $1.50 USDC = 1500000 microUSDC
- **Storage**: Use appropriate numeric types (Long for large amounts, Double for calculations)
- **ALL currency display must be with 4 decimal places and MUST display units**

### API Design Philosophy
- **NEVER make fields nullable for backward compatibility**
- **Fail early, not accept bad data** - let things break rather than silently accept incomplete requests
- **Required fields must be required** - use proper validation annotations

### MOBILE DEVELOPMENT PROCESS
when you've made changes, you can go through the following cycle:
0. Understand the requirements from the user (me) - make sure you ask the right questions to get a full understanding
  once you understand, you'll be able to choose the right place in the cycle to start the process
1. npm test 
2. commit your changes to git (use extensive comments)
3. look at the lastest git tag that starts farcaster-test-v.... and add the next one using my git shortcut (git tag-push farcaster-text-vXX.X.X) 
  this will run the build and deploy on CI/CD
4. ask the user (me) to run the test in the UI
5. ssh onto the dev server (ssh -l gituser api.conduit-ucpi.com)
6. in the ssh session run this: docker logs webapp-test > /tmp/autolog.log 2>&1
8. copy the logs to the local machine (scp gituser@api.conduit-ucpi.com:/tmp/autolog.log .
9. analyse the log, make changes to fix what you see, as the user (me) any questions about what they saw in the UI etc...
  NB during your analysis use all your intelligence, your access to the internet, your access to the whole codebase and
    all the libraries used to make good decisions. Make extensive notes in the MOBILE_SIGNING_DEBUG.md file
    so that you don't re-invent the wheel and you don't go over the same ground again
  NB2 - you want to look at the end of the logfile rather than beginning, so that you're looking at the latest events rather than the oldest ones
10. repeat the whole cycle until the problem is fixed
