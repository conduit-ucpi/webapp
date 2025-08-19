# Conduit UCPI Web3 SDK - Frontend

A Next.js web application for creating and managing time-delayed escrow contracts on Avalanche blockchain.

## Features

- **Pluggable Wallet Support**: Abstract wallet provider system supporting Web3Auth, Farcaster, and more
- **Secure Authentication**: Wallet-based login with provider-agnostic authentication
- **Escrow Contracts**: Create time-delayed escrow agreements with built-in dispute resolution
- **USDC Support**: Native USDC token support with automatic approval handling
- **MoonPay Integration**: Direct USDC purchases within the app (coming soon)
- **Real-time Updates**: Auto-refreshing dashboard for contract status changes
- **Mobile Responsive**: Optimized for all device sizes

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### Required Environment Variables

- `WEB3AUTH_CLIENT_ID`: Your Web3Auth project client ID
- `CONTRACT_FACTORY_ADDRESS`: Deployed escrow factory contract address
- `MOONPAY_API_KEY`: MoonPay API key for USDC purchases

### Backend Services

The app requires two backend microservices:

- **User Service** (port 8977): Handles authentication and user management
- **Chain Service** (port 8978): Manages blockchain interactions and contract deployment

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Web3**: Abstract wallet providers + ethers.js
- **Wallet Support**: Web3Auth (default), extensible to Farcaster, MetaMask, etc.
- **UI**: Headless UI components
- **Payments**: MoonPay SDK

## Architecture

This is a frontend-focused application that proxies API calls to backend microservices. Key architectural decisions:

- **Provider-Agnostic Wallet System**: Abstract wallet interface supporting multiple providers
- Client-side transaction signing with server-side submission
- HTTP-only cookies for secure authentication
- Context-based state management (no Redux/Zustand needed)
- Component-based architecture with clear separation of concerns

### Wallet Provider System

The application uses an abstract wallet provider system that allows easy integration of different wallet solutions:

```typescript
// All wallet providers implement this interface
interface WalletProvider {
  getAddress(): Promise<string>;
  signTransaction(params: TransactionRequest): Promise<string>;
  signMessage(message: string): Promise<string>;
  request(args: { method: string; params?: any[] }): Promise<any>;
  isConnected(): boolean;
  getProviderName(): string;
  getEthersProvider(): any;
}
```

#### Supported Wallet Providers

- **Web3Auth**: Social login and traditional wallet integration
- **Farcaster**: (Example implementation provided) Frame-based authentication
- **Custom Providers**: Easy to add by implementing the `WalletProvider` interface

#### Adding a New Wallet Provider

1. **Create Provider Class**
   ```typescript
   // lib/wallet/my-provider.ts
   import { WalletProvider, TransactionRequest } from './types';
   
   export class MyWalletProvider implements WalletProvider {
     async getAddress(): Promise<string> {
       // Your implementation
     }
     
     async signTransaction(params: TransactionRequest): Promise<string> {
       // Your signing logic
     }
     
     // ... implement other methods
   }
   ```

2. **Use in Component**
   ```typescript
   import { useWallet } from '@/lib/wallet/WalletProvider';
   import { MyWalletProvider } from '@/lib/wallet/my-provider';
   
   function MyConnectButton() {
     const { connectWallet } = useWallet();
     
     const handleConnect = async () => {
       const provider = new MyWalletProvider(/* config */);
       await connectWallet(provider);
     };
   }
   ```

3. **No Other Changes Needed**
   - Web3Service automatically works with any provider
   - Transaction signing uses the abstract interface
   - Authentication flow remains the same

#### Architecture Benefits

- **Provider Independence**: Core logic doesn't depend on specific wallet implementations
- **Easy Testing**: Mock wallet providers for comprehensive testing
- **Future-Proof**: Add new wallet types without changing existing code
- **Consistent API**: Same interface regardless of underlying wallet technology

## Wallet Provider Integration Guide

### Current Providers

| Provider | Status | Use Case |
|----------|--------|-----------|
| Web3Auth | ✅ Active | Social login, email-based auth, traditional wallets |
| Farcaster | 📝 Example | Frame-based authentication, social proof |
| Custom | 🔧 Template | Your custom wallet solution |

### Implementation Examples

#### Web3Auth Provider (Default)
```typescript
import { Web3AuthWalletProvider } from '@/lib/wallet/web3auth-provider';

// In your connection logic
const web3authProvider = await connect(); // Web3Auth connection
const walletProvider = new Web3AuthWalletProvider(web3authProvider);
await connectWallet(walletProvider);
```

#### Custom Provider Template
```typescript
import { WalletProvider, TransactionRequest } from '@/lib/wallet/types';

export class CustomWalletProvider implements WalletProvider {
  constructor(private customSigner: any) {}

  async getAddress(): Promise<string> {
    return await this.customSigner.getAddress();
  }

  async signTransaction(params: TransactionRequest): Promise<string> {
    // Your custom signing logic
    const tx = {
      to: params.to,
      data: params.data,
      value: params.value || '0x0',
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      nonce: params.nonce,
      chainId: params.chainId
    };
    return await this.customSigner.signTransaction(tx);
  }

  async signMessage(message: string): Promise<string> {
    return await this.customSigner.signMessage(message);
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    return await this.customSigner.request(args);
  }

  isConnected(): boolean {
    return !!this.customSigner;
  }

  getProviderName(): string {
    return 'Custom Wallet';
  }

  getEthersProvider(): any {
    return new ethers.BrowserProvider(this.customSigner);
  }
}
```

#### Integration in Components
```typescript
import { useWallet } from '@/lib/wallet/WalletProvider';

function WalletSelector() {
  const { connectWallet, walletProvider, isConnected } = useWallet();

  const connectWeb3Auth = async () => {
    const web3authProvider = await initWeb3Auth();
    const provider = new Web3AuthWalletProvider(web3authProvider);
    await connectWallet(provider);
  };

  const connectFarcaster = async () => {
    const farcasterSigner = await initFarcaster();
    const provider = new FarcasterWalletProvider(farcasterSigner);
    await connectWallet(provider);
  };

  return (
    <div>
      {!isConnected ? (
        <>
          <button onClick={connectWeb3Auth}>Connect with Web3Auth</button>
          <button onClick={connectFarcaster}>Connect with Farcaster</button>
        </>
      ) : (
        <p>Connected with {walletProvider?.getProviderName()}</p>
      )}
    </div>
  );
}
```

### Testing Wallet Providers

```typescript
// Create a mock provider for testing
class MockWalletProvider implements WalletProvider {
  constructor(private mockAddress: string = '0x123...') {}
  
  async getAddress(): Promise<string> {
    return this.mockAddress;
  }
  
  async signTransaction(params: TransactionRequest): Promise<string> {
    return 'mock-signed-transaction';
  }
  
  // ... other methods
}

// Use in tests
const mockProvider = new MockWalletProvider('0xtest');
await connectWallet(mockProvider);
```

## Development

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build
```

## Deployment

1. Build the application: `npm run build`
2. Configure environment variables in your deployment platform
3. Deploy to Vercel, Netlify, or your preferred hosting provider
4. Ensure backend microservices are accessible from your deployment

## Security

- Private keys never leave the client
- All authentication via secure JWT tokens and HTTP-only cookies
- Input validation on all user-provided data
- Environment variables for sensitive configuration

---

Built with ❤️ for secure Web3 transactions