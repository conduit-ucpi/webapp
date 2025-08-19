# Conduit UCPI SDK Implementation Plan

## Overview

This document outlines the plan to extract a reusable SDK from the Conduit UCPI webapp, enabling developers to build escrow contract applications using any wallet provider and any frontend framework.

## Design Philosophy

### Framework Agnostic
- **Core SDK**: No React dependencies - works with Vue, Angular, vanilla JS, Node.js
- **React Package**: Separate optional package with React hooks
- **Universal API**: Same interface across all environments

### Wallet Provider Abstraction Preserved
- Leverage existing `WalletProvider` interface from webapp
- Zero wallet-specific dependencies in core SDK
- Developers bring their own wallet implementations
- Optional pre-built adapters for common wallets

### Configuration-Driven Architecture
- Single config object manages all service endpoints
- Environment-aware (testnet/mainnet configurations)
- Extensible for different backend deployments

## SDK Package Structure

```
@conduit-ucpi/sdk/
├── src/
│   ├── core/
│   │   ├── EscrowSDK.ts           # Main SDK class and entry point
│   │   ├── Web3Service.ts         # Blockchain operations (extracted from webapp)
│   │   └── Config.ts              # Configuration management and validation
│   ├── wallet/
│   │   ├── types.ts               # WalletProvider interface (from webapp)
│   │   ├── WalletManager.ts       # Wallet connection state management
│   │   └── adapters/              # Optional pre-built wallet adapters
│   │       ├── web3auth.ts        # Web3Auth adapter (optional import)
│   │       ├── metamask.ts        # MetaMask adapter (optional import)
│   │       └── walletconnect.ts   # WalletConnect adapter (optional import)
│   ├── services/
│   │   ├── ContractService.ts     # Contract CRUD operations via backend
│   │   ├── ChainService.ts        # Transaction submission via chain service
│   │   ├── UserService.ts         # Authentication and user management
│   │   └── types.ts               # Service request/response types
│   ├── contracts/
│   │   ├── EscrowContract.ts      # Smart contract interaction wrapper
│   │   ├── ContractFactory.ts     # Contract creation and deployment
│   │   └── types.ts               # Contract state and event types
│   ├── utils/
│   │   ├── validation.ts          # Input validation (extracted from webapp)
│   │   ├── formatting.ts          # Currency/datetime utilities (extracted from webapp)
│   │   ├── constants.ts           # Contract ABIs and network constants
│   │   └── errors.ts              # Custom error classes and handling
│   └── index.ts                   # Main exports and public API
├── dist/                          # Compiled JavaScript output
├── types/                         # TypeScript declaration files
├── package.json
├── tsconfig.json
├── README.md
└── examples/                      # Usage examples for different frameworks
    ├── vanilla-js/
    ├── react/
    ├── vue/
    └── node-js/
```

## React Hooks Package Structure

```
@conduit-ucpi/sdk-react/
├── src/
│   ├── hooks/
│   │   ├── useEscrowSDK.ts        # Main SDK instance hook
│   │   ├── useWallet.ts           # Wallet connection state
│   │   ├── useContracts.ts        # Contract list management
│   │   ├── useContract.ts         # Individual contract state
│   │   ├── useUSDCBalance.ts      # USDC balance tracking
│   │   └── useAuth.ts             # Authentication state
│   ├── providers/
│   │   ├── EscrowSDKProvider.tsx  # React context provider
│   │   └── types.ts               # React-specific types
│   └── index.ts                   # Hook exports
├── dist/
├── types/
└── package.json
```

## Core API Design

### Main SDK Class

```typescript
import { EscrowSDK } from '@conduit-ucpi/sdk';

// Initialize SDK with configuration
const sdk = new EscrowSDK({
  chainId: 43113,
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
  usdcContractAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
  contractFactoryAddress: '0x...',
  userServiceUrl: 'https://user-service.example.com',
  chainServiceUrl: 'https://chain-service.example.com',
  contractServiceUrl: 'https://contract-service.example.com',
  minGasWei: '5',
  snowtraceBaseUrl: 'https://testnet.snowtrace.io'
});

// Wallet Management
await sdk.connectWallet(walletProvider);
await sdk.disconnectWallet();
const isConnected = sdk.isWalletConnected();
const address = await sdk.getWalletAddress();
const balance = await sdk.getUSDCBalance();

// Authentication
await sdk.login(idToken, walletAddress);
await sdk.logout();
const user = sdk.getCurrentUser();

// Contract Operations
const pendingContract = await sdk.contracts.createPending({
  buyerEmail: 'buyer@example.com',
  amount: 100.0,
  description: 'Product purchase',
  expiryTimestamp: Date.now() + 86400000
});

const contract = await sdk.contracts.accept(pendingContractId, {
  buyer: '0x...',
  seller: '0x...'
});

// Contract Interactions
await sdk.contracts.fund(contractAddress);
await sdk.contracts.raiseDispute(contractAddress, 'Quality issues');
await sdk.contracts.claim(contractAddress);

// Contract Queries
const contractInfo = await sdk.contracts.getInfo(contractAddress);
const contractState = await sdk.contracts.getState(contractAddress);
const userContracts = await sdk.contracts.getUserContracts();

// Utility Methods
const isValidAddress = sdk.utils.isValidWalletAddress('0x...');
const formattedCurrency = sdk.utils.displayCurrency(1500000, 'microUSDC');
const formattedDate = sdk.utils.formatDateTimeWithTZ(1735689600);
```

### React Hooks API

```typescript
import { 
  EscrowSDKProvider, 
  useEscrowSDK, 
  useWallet, 
  useContracts,
  useContract,
  useAuth 
} from '@conduit-ucpi/sdk-react';

// App setup
function App() {
  return (
    <EscrowSDKProvider config={sdkConfig}>
      <MyEscrowApp />
    </EscrowSDKProvider>
  );
}

// Component usage
function MyEscrowApp() {
  const sdk = useEscrowSDK();
  const { isConnected, address, connectWallet } = useWallet();
  const { user, login, logout } = useAuth();
  const { contracts, loading, refresh } = useContracts();
  const contractDetails = useContract(contractAddress);

  const handleConnect = async () => {
    const provider = new MyWalletProvider();
    await connectWallet(provider);
  };

  return (
    <div>
      {!isConnected ? (
        <button onClick={handleConnect}>Connect Wallet</button>
      ) : (
        <ContractDashboard contracts={contracts} />
      )}
    </div>
  );
}
```

## Implementation Phases

### Phase 1: Core Extraction (Week 1-2)
**Goal**: Extract wallet-agnostic core functionality

**Tasks**:
1. **Setup SDK package structure**
   - Initialize npm package with TypeScript
   - Configure build pipeline (Rollup/Webpack)
   - Setup testing framework (Jest)

2. **Extract core classes**
   - Extract `Web3Service` class (lib/web3.ts → core/Web3Service.ts)
   - Extract `WalletProvider` types (lib/wallet/types.ts → wallet/types.ts)
   - Create main `EscrowSDK` class as facade

3. **Extract utilities**
   - Copy validation utilities (utils/validation.ts → utils/validation.ts)
   - Copy formatting utilities (currency/datetime functions)
   - Extract contract ABIs and constants

4. **Configuration system**
   - Create `Config` class for centralized configuration
   - Environment detection and validation
   - Default configurations for testnet/mainnet

**Deliverables**:
- Basic SDK package with core wallet and Web3 functionality
- TypeScript types and interfaces
- Unit tests for core utilities

### Phase 2: Service Integration (Week 3-4)
**Goal**: Integrate backend service communications

**Tasks**:
1. **Contract Service integration**
   - Extract contract CRUD operations from webapp API routes
   - Create `ContractService` class for backend communication
   - Implement pending contract flow

2. **Chain Service integration**
   - Extract transaction submission logic
   - Create `ChainService` class for signed transaction relay
   - Implement gas estimation and transaction preparation

3. **User Service integration**
   - Extract authentication flow
   - Create `UserService` class for login/logout/identity
   - Handle JWT token management

4. **Error handling**
   - Create custom error classes
   - Implement consistent error handling across services
   - Add error recovery mechanisms

**Deliverables**:
- Full backend service integration
- Complete contract lifecycle management
- Comprehensive error handling system

### Phase 3: React Integration (Week 5)
**Goal**: Create React-specific package and hooks

**Tasks**:
1. **React hooks package**
   - Create separate `@conduit-ucpi/sdk-react` package
   - Implement core hooks (useEscrowSDK, useWallet, useContracts)
   - Create React context providers

2. **State management**
   - Implement reactive state updates for contracts
   - Handle wallet connection state changes
   - Manage authentication state

3. **React-specific utilities**
   - Create React-friendly error handling
   - Implement loading states and suspense support
   - Add optimistic updates for better UX

**Deliverables**:
- React hooks package ready for use
- React context providers for state management
- Example React application

### Phase 4: Developer Experience (Week 6-7)
**Goal**: Polish developer experience and documentation

**Tasks**:
1. **Optional wallet adapters**
   - Create Web3Auth adapter (optional import)
   - Create MetaMask/browser wallet adapter
   - Create WalletConnect adapter
   - Document custom adapter creation

2. **Documentation and examples**
   - Comprehensive API documentation
   - Usage examples for different frameworks
   - Migration guide from direct integration
   - Best practices guide

3. **Testing and validation**
   - Integration tests with real backend services
   - Example applications for different frameworks
   - Performance testing and optimization

**Deliverables**:
- Complete documentation and examples
- Optional wallet adapters
- Production-ready SDK packages

### Phase 5: Migration and Publishing (Week 8)
**Goal**: Migrate webapp to use SDK and publish packages

**Tasks**:
1. **Webapp migration**
   - Replace webapp's direct implementations with SDK usage
   - Ensure feature parity and no regressions
   - Update webapp dependencies

2. **Package publishing**
   - Publish to npm registry
   - Setup CI/CD for automatic publishing
   - Create versioning strategy

3. **Documentation site**
   - Create SDK documentation website
   - Interactive examples and playground
   - API reference documentation

**Deliverables**:
- Webapp fully migrated to use SDK
- Published npm packages
- Documentation website

## Benefits Analysis

### For Conduit UCPI Platform
- **Code Reuse**: Webapp becomes consumer of own SDK
- **Consistency**: Same business logic across all applications
- **Maintenance**: Single codebase for core functionality
- **Quality**: Concentrated testing and bug fixes
- **Extensibility**: Easy to add new features once

### For Developers
- **Wallet Freedom**: Use any wallet provider implementation
- **Framework Choice**: Works with React, Vue, Angular, vanilla JS
- **Type Safety**: Full TypeScript support throughout
- **Minimal Bundle**: Tree-shakable imports, only use what you need
- **Battle Tested**: Based on production webapp code
- **Documentation**: Comprehensive guides and examples

### For Ecosystem
- **Standardization**: Common patterns for escrow applications
- **Innovation**: Developers focus on UX instead of infrastructure
- **Adoption**: Lower barrier to entry for escrow integrations
- **Network Effects**: More applications using Conduit contracts

## Migration Strategy

### Gradual Migration Approach
1. **Create SDK alongside webapp** (no changes to existing code)
2. **Test SDK thoroughly** using webapp as reference
3. **Migrate webapp incrementally** (one feature at a time)
4. **Validate each migration step** (ensure no regressions)
5. **Publish SDK** once webapp fully migrated
6. **Maintain backwards compatibility** during transition

### Risk Mitigation
- **Feature flags**: Enable/disable SDK usage per feature
- **Parallel testing**: Run both implementations during migration
- **Rollback plan**: Quick revert to original implementation
- **Monitoring**: Track performance and error rates during migration

## Technical Considerations

### Bundle Size Optimization
- **Tree-shaking**: Enable selective imports of SDK features
- **Code splitting**: Separate core SDK from optional adapters
- **Dependencies**: Minimize external dependencies
- **Build optimization**: Use Rollup for optimal bundle sizes

### Performance Considerations
- **Lazy loading**: Load wallet adapters only when needed
- **Caching**: Cache contract state and user data appropriately
- **Batching**: Batch multiple contract queries when possible
- **Optimistic updates**: Update UI before backend confirmation

### Security Considerations
- **No private keys**: SDK never handles private keys directly
- **Input validation**: Validate all inputs before backend calls
- **Error sanitization**: Don't leak sensitive information in errors
- **Audit trail**: Log important operations for debugging

## Success Metrics

### Technical Metrics
- **Bundle size**: Core SDK < 50KB gzipped
- **Performance**: Contract operations < 2s response time
- **Reliability**: > 99.9% success rate for transaction signing
- **Compatibility**: Works with 5+ wallet providers

### Developer Experience Metrics
- **Setup time**: < 10 minutes to first working integration
- **Documentation coverage**: 100% of public API documented
- **Example coverage**: Examples for 3+ frontend frameworks
- **Community adoption**: 10+ external integrations within 6 months

## Next Steps

1. **Review and approve** this implementation plan
2. **Setup development environment** and package structure
3. **Begin Phase 1** with core extraction
4. **Establish testing strategy** and CI/CD pipeline
5. **Create project timeline** with specific milestones

## Questions for Consideration

1. **Package naming**: Confirm npm organization and package names
2. **Versioning strategy**: Semantic versioning approach and breaking change policy
3. **Browser support**: Minimum browser versions to support
4. **Backend compatibility**: Versioning strategy for backend service APIs
5. **License**: Open source license choice for SDK packages
6. **Maintenance**: Long-term maintenance and support strategy

---

This plan provides a comprehensive roadmap for extracting a production-ready SDK while preserving the excellent wallet abstraction architecture already in place.