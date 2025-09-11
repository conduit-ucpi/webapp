import React, { useState, useEffect, createContext, useContext } from 'react';
import { useAccount, useConnect, useDisconnect, useEnsName, useSignMessage, useWalletClient, useSendCalls } from 'wagmi';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { encodeFunctionData } from 'viem';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { 
  AuthUser, 
  AuthState, 
  AuthResult, 
  IAuthProvider,
  AuthContextType,
  AuthEvent
} from './authInterface';
import { useConfig } from '../auth/ConfigProvider';
import { ethers, formatUnits } from 'ethers';
import { createFarcasterContractMethods } from '@/utils/contractTransactionFactory';
import { BackendAuth } from './backendAuth';

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * Synthetic Ethers Provider for Farcaster
 * Combines JSON-RPC for reads and Wagmi for signing
 */
class FarcasterSyntheticProvider {
  private jsonRpcProvider: ethers.JsonRpcProvider;
  private rpcUrl: string;
  private address: string | undefined;
  private signMessageAsync: ((args: { message: string }) => Promise<string>) | undefined;
  
  constructor(
    rpcUrl: string, 
    address?: string,
    signMessageAsync?: (args: { message: string }) => Promise<string>
  ) {
    this.jsonRpcProvider = new ethers.JsonRpcProvider(rpcUrl);
    this.rpcUrl = rpcUrl;
    this.address = address;
    this.signMessageAsync = signMessageAsync;
  }
  
  // Ethers provider interface methods
  async getNetwork() {
    return this.jsonRpcProvider.getNetwork();
  }
  
  async getBlockNumber() {
    return this.jsonRpcProvider.getBlockNumber();
  }
  
  async getBalance(address: string) {
    return this.jsonRpcProvider.getBalance(address);
  }
  
  async getTransactionCount(address: string) {
    return this.jsonRpcProvider.getTransactionCount(address);
  }
  
  async estimateGas(tx: any) {
    return this.jsonRpcProvider.estimateGas(tx);
  }
  
  async getFeeData() {
    // Use direct RPC call instead of provider's getFeeData to avoid inflated gas values
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_gasPrice',
          params: [],
          id: 1
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.result) {
          return {
            gasPrice: BigInt(result.result),
            maxFeePerGas: null,
            maxPriorityFeePerGas: null
          };
        }
      }
    } catch (error) {
      console.warn('Failed to get gas price from RPC in Farcaster provider:', error);
    }
    
    // Fallback to a reasonable gas price instead of provider's getFeeData
    return {
      gasPrice: BigInt('1000000000'), // 1 gwei fallback
      maxFeePerGas: null,
      maxPriorityFeePerGas: null
    };
  }
  
  async call(tx: any) {
    return this.jsonRpcProvider.call(tx);
  }
  
  // The key method - returns a signer that uses Wagmi for signing
  async getSigner() {
    if (!this.address || !this.signMessageAsync) {
      throw new Error('Wallet not connected');
    }
    
    const address = this.address;
    const signMessageAsync = this.signMessageAsync;
    const provider = this.jsonRpcProvider;
    
    return {
      provider: this,
      
      async getAddress() {
        return address;
      },
      
      async signMessage(message: string) {
        return await signMessageAsync({ message });
      },
      
      async signTransaction(tx: any) {
        console.log('🔧 FarcasterSyntheticProvider: signTransaction called - delegating to Wagmi');
        console.log('🔧 FarcasterSyntheticProvider: this.address =', address);
        console.log('🔧 FarcasterSyntheticProvider: tx.to =', tx.to);
        
        // This method should not be called anymore since we use Wagmi directly
        // But if it is called, we'll provide a helpful error
        throw new Error('FarcasterSyntheticProvider.signTransaction should not be used - use Wagmi walletClient.signTransaction directly');
      },
      
      async sendTransaction(tx: any) {
        const signedTx = await this.signTransaction(tx);
        return await provider.broadcastTransaction(signedTx);
      }
    };
  }
}

interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: {
    url: string;
  };
}

interface FarcasterContext {
  user: FarcasterUser;
}

/**
 * Farcaster Auth Provider implementation
 */
class FarcasterAuthProviderImpl implements IAuthProvider {
  private state: AuthState = {
    user: null,
    token: null,
    isConnected: false,
    isLoading: false,
    isInitialized: false,
    error: null,
    providerName: 'farcaster'
  };
  
  private sdk: any = null;
  private listeners = new Map<AuthEvent['type'], Set<(event: AuthEvent) => void>>();
  private visitedKey = 'farcaster_auth_visited';

  async initialize(): Promise<void> {
    console.log('🔧 Farcaster Provider: Initialize called - setting up SDK reference');
    
    // Get SDK from global storage set by React component
    this.sdk = (window as any).__farcasterSDK;
    
    if (this.sdk) {
      console.log('🔧 Farcaster Provider: SDK reference established');
      this.state.isInitialized = true;
    } else {
      console.log('🔧 Farcaster Provider: SDK not yet available, will retry');
    }
    
    this.state.isLoading = false;
  }
  
  async connect(): Promise<AuthResult> {
    // Get wallet address from current state or throw error
    const walletAddress = this.walletAddress;
    if (!walletAddress) {
      throw new Error('Wallet must be connected before calling connect()');
    }
    
    return this.connectWithAddress(walletAddress);
  }
  
  private walletAddress: string | null = null;
  
  setWalletAddress(address: string | null): void {
    this.walletAddress = address;
  }
  
  private async connectWithAddress(walletAddress: string): Promise<AuthResult> {
    try {
      this.state.isLoading = true;
      this.state.error = null;
      this.emit({ type: 'connecting' });
      
      // Re-establish SDK reference in case it wasn't available during initialize
      if (!this.sdk) {
        this.sdk = (window as any).__farcasterSDK;
      }
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }
      
      // Get Farcaster context
      const context = await this.sdk.context;
      if (!context?.user) {
        throw new Error('No Farcaster user context');
      }
      
      // Get auth token from global storage (set by React component during QuickAuth step)
      const token = (window as any).__farcasterToken;
      
      if (!token || !token.includes('.') || token.split('.').length !== 3) {
        throw new Error('Invalid JWT token from Farcaster - token should have been set during QuickAuth step');
      }
      
      // Wallet address is required for connection
      if (!walletAddress) {
        throw new Error('Wallet address required for connection');
      }
      
      // Create user object
      const user: AuthUser = {
        userId: `farcaster_${context.user.fid}`,
        walletAddress,
        fid: context.user.fid,
        username: context.user.username,
        displayName: context.user.displayName,
        profileImageUrl: context.user.pfp?.url,
        authProvider: 'farcaster'
      };
      
      // Update state
      this.state.user = user;
      this.state.token = token;
      this.state.isConnected = true;
      
      console.log('🔧 Farcaster Provider: Connection successful!', {
        fid: user.fid,
        walletAddress: user.walletAddress,
        hasToken: !!token
      });
      
      // Emit success event
      this.emit({ type: 'connected', user, token });
      
      return { user, token };
      
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Connection failed';
      this.emit({ type: 'error', error: this.state.error });
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }
  
  async disconnect(): Promise<void> {
    try {
      // Clear state
      this.state.user = null;
      this.state.token = null;
      this.state.isConnected = false;
      
      this.emit({ type: 'disconnected' });
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : 'Disconnect failed';
      throw error;
    }
  }
  
  
  getState(): AuthState {
    return { ...this.state };
  }
  
  isReady(): boolean {
    return this.state.isInitialized && !this.state.isLoading;
  }
  
  dispose(): void {
    this.listeners.clear();
    this.sdk = null;
  }
  
  // Event handling
  on(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(handler);
  }
  
  off(event: AuthEvent['type'], handler: (event: AuthEvent) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
  
  private emit(event: AuthEvent): void {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
  
  // Helper methods for AuthContextType
  getToken(): string | null {
    return this.state.token;
  }
  
  
  hasVisitedBefore(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.visitedKey) === 'true';
    }
    return false;
  }
  
  markAsVisited(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.visitedKey, 'true');
    }
  }
  
  // These methods need to be implemented by the React component
  // They're just stubs here to satisfy the interface
  async signMessage(message: string): Promise<string> {
    throw new Error('signMessage must be implemented by React component');
  }
  
  getEthersProvider(): any {
    throw new Error('getEthersProvider must be implemented by React component');
  }
  
  async getUSDCBalance(userAddress?: string): Promise<string> {
    // This will be properly implemented by the React component context
    // For now, return a placeholder to avoid the error
    return '0';
  }
  
  private signContractTransactionCallback?: (params: any) => Promise<string>;
  private contractMethods: any = {};
  
  setSignContractTransactionCallback(callback: (params: any) => Promise<string>) {
    this.signContractTransactionCallback = callback;
  }
  
  setContractMethods(methods: any) {
    console.log('🔧 Farcaster Provider: Setting contract methods:', {
      hasFundContract: !!methods.fundContract,
      hasClaimFunds: !!methods.claimFunds,
      hasRaiseDispute: !!methods.raiseDispute,
      methodKeys: Object.keys(methods)
    });
    this.contractMethods = methods;
  }
  
  async waitForTransaction(transactionHash: string, maxWaitTime?: number): Promise<void> {
    // Farcaster transactions are already confirmed when they return
    // This is a no-op to satisfy the interface
    console.log(`🔧 Farcaster Provider: Transaction already confirmed: ${transactionHash}`);
    return Promise.resolve();
  }

  async signContractTransaction(params: any): Promise<string> {
    if (this.signContractTransactionCallback) {
      return await this.signContractTransactionCallback(params);
    }
    throw new Error('signContractTransaction not yet initialized - React component still loading');
  }

  // Contract transaction methods from factory
  async createContract(...args: any[]): Promise<any> {
    if (this.contractMethods.createContract) {
      return await this.contractMethods.createContract(...args);
    }
    throw new Error('createContract not available');
  }

  async approveUSDC(...args: any[]): Promise<any> {
    if (this.contractMethods.approveUSDC) {
      return await this.contractMethods.approveUSDC(...args);
    }
    throw new Error('approveUSDC not available');
  }

  async depositFunds(...args: any[]): Promise<any> {
    if (this.contractMethods.depositFunds) {
      return await this.contractMethods.depositFunds(...args);
    }
    throw new Error('depositFunds not available');
  }

  async fundContract(...args: any[]): Promise<any> {
    console.log('🔧 Farcaster Provider: fundContract called, checking availability:', {
      hasMethod: !!this.contractMethods.fundContract,
      contractMethodsKeys: Object.keys(this.contractMethods)
    });
    
    if (this.contractMethods.fundContract) {
      try {
        console.log('🔧 Farcaster Provider: Calling contract methods fundContract...');
        const result = await this.contractMethods.fundContract(...args);
        console.log('🔧 Farcaster Provider: fundContract completed successfully');
        return result;
      } catch (error) {
        console.error('🔧 Farcaster Provider: fundContract failed:', error);
        console.error('🔧 Farcaster Provider: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        throw error;
      }
    }
    throw new Error('fundContract not available');
  }

  async claimFunds(...args: any[]): Promise<any> {
    console.log('🔧 Farcaster Provider: claimFunds called, checking availability:', {
      hasMethod: !!this.contractMethods.claimFunds,
      contractMethodsKeys: Object.keys(this.contractMethods)
    });
    
    if (this.contractMethods.claimFunds) {
      try {
        console.log('🔧 Farcaster Provider: Calling contract methods claimFunds...');
        const result = await this.contractMethods.claimFunds(...args);
        console.log('🔧 Farcaster Provider: claimFunds completed successfully');
        return result;
      } catch (error) {
        console.error('🔧 Farcaster Provider: claimFunds failed:', error);
        console.error('🔧 Farcaster Provider: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        throw error;
      }
    }
    throw new Error('claimFunds not available');
  }

  async raiseDispute(...args: any[]): Promise<any> {
    console.log('🔧 Farcaster Provider: raiseDispute called, checking availability:', {
      hasMethod: !!this.contractMethods.raiseDispute,
      contractMethodsKeys: Object.keys(this.contractMethods)
    });
    
    if (this.contractMethods.raiseDispute) {
      try {
        console.log('🔧 Farcaster Provider: Calling contract methods raiseDispute...');
        const result = await this.contractMethods.raiseDispute(...args);
        console.log('🔧 Farcaster Provider: raiseDispute completed successfully');
        return result;
      } catch (error) {
        console.error('🔧 Farcaster Provider: raiseDispute failed:', error);
        console.error('🔧 Farcaster Provider: Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : 'No stack'
        });
        throw error;
      }
    }
    throw new Error('raiseDispute not available');
  }
}

// Create singleton instance
let farcasterAuthProvider: FarcasterAuthProviderImpl | null = null;

export function getFarcasterAuthProvider(config?: any): IAuthProvider {
  if (!farcasterAuthProvider) {
    farcasterAuthProvider = new FarcasterAuthProviderImpl();
  }
  return farcasterAuthProvider;
}

// Wagmi configuration for Farcaster environment
const createFarcasterWagmiConfig = (chainId: number) => {
  // Dynamic chain selection based on configured chain ID
  const chainMap: Record<number, any> = {
    8453: base,      // Base Mainnet
    84532: baseSepolia, // Base Sepolia
    // Add more chains as needed
  };
  
  const chain = chainMap[chainId];
  if (!chain) {
    throw new Error(`Unsupported chain ID for Farcaster: ${chainId}. Supported chains: ${Object.keys(chainMap).join(', ')}`);
  }
  
  return createConfig({
    chains: [chain],
    transports: {
      [chainId]: http(),
    },
    connectors: [
      farcasterMiniApp() // Official Farcaster miniapp connector
    ],
    ssr: false,
  });
};

// Singleton instances to prevent multiple providers
let globalQueryClient: QueryClient | null = null;
let globalWagmiConfig: any | null = null;

// Query client for React Query (required by Wagmi) - singleton
function getQueryClient() {
  if (!globalQueryClient) {
    globalQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          refetchOnWindowFocus: false,
          retry: false,
        },
      },
    });
  }
  return globalQueryClient;
}

// Wagmi config singleton
function getWagmiConfig(chainId: number) {
  if (!globalWagmiConfig) {
    globalWagmiConfig = createFarcasterWagmiConfig(chainId);
  }
  return globalWagmiConfig;
}

// Singleton flags to prevent duplicate SDK initialization in React Strict Mode
let isSDKInitialized = false;
let isQuickAuthInitialized = false;
let quickAuthPromise: Promise<any> | null = null;

// Track inner component instances
let innerComponentCount = 0;

// Track if main provider has been rendered to prevent duplicates
let mainProviderInstanceCount = 0;

/**
 * React Context for Farcaster Auth
 */
const FarcasterAuthContext = createContext<AuthContextType | null>(null);

/**
 * Inner Farcaster Auth Provider React Component (with Wagmi hooks)
 */
function FarcasterAuthProviderInner({ children, AuthContext }: { 
  children: React.ReactNode;
  AuthContext?: React.Context<any>;
}) {
  // Track this instance
  const innerInstanceId = React.useRef(Math.random().toString(36).substr(2, 9));
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  React.useEffect(() => {
    innerComponentCount++;
    console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: MOUNTED (total inner instances: ${innerComponentCount})`);
    
    return () => {
      innerComponentCount--;
      console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: UNMOUNTED (remaining inner instances: ${innerComponentCount})`);
    };
  }, []);
  
  console.log(`🔧 FarcasterAuthProviderInner [${innerInstanceId.current}]: RENDER #${renderCount.current}`);
  
  const [authState, setAuthStateOriginal] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'farcaster'
  });
  
  // Smart setAuthState that only updates when connection status changes
  const setAuthState = React.useCallback((newState: AuthState | ((prev: AuthState) => AuthState)) => {
    if (typeof newState === 'function') {
      setAuthStateOriginal(newState);
      return;
    }
    
    // Only update if the connection status has actually changed
    const currentState = authState;
    const connectionChanged = (
      currentState.isConnected !== newState.isConnected ||
      currentState.isLoading !== newState.isLoading ||
      currentState.error !== newState.error ||
      (!currentState.user && newState.user) || // First time getting user data
      (currentState.user && !newState.user)    // Losing user data
    );
    
    if (connectionChanged) {
      console.log('🔧 Farcaster: Auth state meaningfully changed, updating');
      setAuthStateOriginal(newState);
    } else {
      console.log('🔧 Farcaster: Auth state unchanged, skipping update');
    }
  }, [authState]);
  
  const provider = getFarcasterAuthProvider();
  const { address, isConnected: walletConnected } = useAccount();
  const { connectors } = useConnect();
  const { disconnect: disconnectWallet } = useDisconnect();
  const { data: ensName } = useEnsName({ address, chainId: 1 });
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  const { config } = useConfig();
  
  // Debug logging for wallet state
  React.useEffect(() => {
    console.log('🔧 FarcasterAuth: Wagmi wallet state changed');
    console.log('🔧 FarcasterAuth: address =', address);
    console.log('🔧 FarcasterAuth: walletConnected =', walletConnected);
    console.log('🔧 FarcasterAuth: connectors =', connectors.map(c => ({
      name: c.name, 
      id: c.id,
      type: c.type,
      ready: c.ready
    })));
    console.log('🔧 FarcasterAuth: Total connectors found:', connectors.length);
    
    // Check if these are browser extension wallets
    const hasMetamask = connectors.some(c => c.name?.toLowerCase().includes('metamask'));
    const hasWalletConnect = connectors.some(c => c.name?.toLowerCase().includes('walletconnect'));
    const hasFarcaster = connectors.some(c => 
      c.name?.toLowerCase().includes('farcaster') || c.id?.includes('miniapp')
    );
    
    console.log('🔧 FarcasterAuth: Has MetaMask:', hasMetamask);
    console.log('🔧 FarcasterAuth: Has WalletConnect:', hasWalletConnect);
    console.log('🔧 FarcasterAuth: Has Farcaster:', hasFarcaster);
    
    if (walletClient) {
      console.log('🔧 FarcasterAuth: walletClient.account.address =', walletClient.account?.address);
    }
  }, [address, walletConnected, connectors.length, walletClient]);
  
  // Patch the provider with real implementations that have access to React hooks
  React.useEffect(() => {
    if (!provider) return;
    
    // Override the stub methods with real implementations
    (provider as any).signMessage = async (message: string) => {
      if (!signMessageAsync) {
        throw new Error('Sign message not available');
      }
      return await signMessageAsync({ message });
    };
    
    (provider as any).getEthersProvider = () => {
      if (!config?.rpcUrl) {
        throw new Error('RPC URL not configured');
      }
      // Return simple JsonRpcProvider - signing handled by Wagmi
      return new ethers.JsonRpcProvider(config.rpcUrl);
    };
    
    (provider as any).getUSDCBalance = async (userAddress?: string) => {
      if (!config?.rpcUrl || !config?.usdcContractAddress) {
        console.warn('getUSDCBalance: RPC URL or USDC contract address not configured');
        return '0';
      }
      
      // Use JsonRpcProvider to read from blockchain
      const jsonProvider = new ethers.JsonRpcProvider(config.rpcUrl);
      const usdcContract = new ethers.Contract(
        config.usdcContractAddress,
        ERC20_ABI,
        jsonProvider
      );
      
      const targetAddress = userAddress || address;
      if (!targetAddress) {
        console.warn('getUSDCBalance: No address available');
        return '0';
      }
      
      try {
        const balance = await usdcContract.balanceOf(targetAddress);
        return formatUnits(balance, 6);
      } catch (error) {
        console.error('getUSDCBalance error:', error);
        return '0';
      }
    };
    
    // Shared transaction signing function to avoid code duplication
    const signTransactionWithWagmi = async (params: {
      contractAddress: string;
      abi: any[];
      functionName: string;
      functionArgs: any[];
      debugLabel?: string;
    }): Promise<string> => {
      if (!signMessageAsync || !address) {
        throw new Error('Sign message not available - ensure Farcaster connector is connected');
      }
      
      console.log(`🔧 Farcaster: Signing transaction for ${params.debugLabel} using Wagmi address:`, address);
      
      // Create contract interface to encode the function call
      const iface = new ethers.Interface(params.abi);
      const data = iface.encodeFunctionData(params.functionName, params.functionArgs);
      
      // Build transaction with Wagmi address
      if (!config) {
        throw new Error('Config not available');
      }
      const jsonProvider = new ethers.JsonRpcProvider(config.rpcUrl);
      const nonce = await jsonProvider.getTransactionCount(address);
      const gasLimit = await jsonProvider.estimateGas({ 
        from: address,
        to: params.contractAddress,
        data 
      });
      // Get gas price via direct RPC call to avoid inflated values
      let gasPrice: bigint | null = null;
      try {
        const response = await fetch(config.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_gasPrice',
            params: [],
            id: 1
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.result) {
            gasPrice = BigInt(result.result);
          }
        }
      } catch (error) {
        console.warn('Failed to get gas price from RPC:', error);
      }
      
      // Fallback to reasonable gas price if RPC fails
      if (!gasPrice) {
        gasPrice = BigInt('1000000000'); // 1 gwei fallback
      }
      const chainId = (await jsonProvider.getNetwork()).chainId;
      
      const transaction = {
        to: params.contractAddress,
        data,
        value: 0,
        gasLimit,
        gasPrice,
        nonce,
        chainId: Number(chainId),
        type: 0 // Legacy transaction type for compatibility
      };
      
      console.log('🔧 Farcaster: Transaction object:', transaction);
      
      console.log('🔧 Farcaster: Trying direct EIP-1193 provider methods...');
      
      // Let's try several different approaches to get transaction signing
      if (walletClient && walletClient.transport && walletClient.transport.request) {
        
        // Try 1: Standard eth_signTransaction
        try {
          console.log('🔧 Farcaster: Trying standard eth_signTransaction');
          
          // Ensure all values are properly formatted as hex strings
          const value = transaction.value || 0;
          const gas = transaction.gasLimit || 21000;
          const gasPrice = transaction.gasPrice || 1000000000; // 1 gwei fallback
          const nonce = transaction.nonce || 0;
          
          const txRequest = {
            from: address,
            to: transaction.to,
            data: transaction.data || '0x',
            value: `0x${value.toString(16)}`,
            gas: `0x${gas.toString(16)}`,
            gasPrice: `0x${gasPrice.toString(16)}`,
            nonce: `0x${nonce.toString(16)}`,
          };
          
          console.log('🔧 Farcaster: Transaction request:', txRequest);
          
          const signedTx = await walletClient.transport.request({
            method: 'eth_signTransaction',
            params: [txRequest],
          });
          
          console.log('🔧 Farcaster: ✅ eth_signTransaction successful! Signed transaction:', signedTx);
          return signedTx as string; // This returns the signed transaction bytes
          
        } catch (error) {
          console.log('🔧 Farcaster: eth_signTransaction failed:', (error as any).message);
        }
        
        // Try 2: Alternative method names that might work
        const alternativeMethods = [
          'eth_sign',
          'wallet_signTransaction', 
          'personal_signTransaction',
          'fc_signTransaction', // Farcaster-specific?
          'miniapp_signTransaction' // Mini-app specific?
        ];
        
        for (const method of alternativeMethods) {
          try {
            console.log(`🔧 Farcaster: Trying alternative method: ${method}`);
            
            const txRequest = {
              from: address,
              to: transaction.to,
              data: transaction.data || '0x',
              value: `0x${(transaction.value || 0).toString(16)}`,
              gas: `0x${(transaction.gasLimit || 21000).toString(16)}`,
              gasPrice: `0x${(transaction.gasPrice || 1000000000).toString(16)}`,
              nonce: `0x${(transaction.nonce || 0).toString(16)}`,
            };
            
            const result = await walletClient.transport.request({
              method,
              params: [txRequest],
            });
            
            console.log(`🔧 Farcaster: ✅ ${method} worked! Result:`, result);
            return result as string;
            
          } catch (error) {
            console.log(`🔧 Farcaster: ${method} failed:`, (error as any).message);
          }
        }
        
        // Try 3: See what methods ARE available
        try {
          console.log('🔧 Farcaster: Checking what methods are available...');
          
          // Some providers expose available methods
          const methods = await walletClient.transport.request({
            method: 'rpc_modules',
            params: [],
          });
          
          console.log('🔧 Farcaster: Available RPC modules:', methods);
          
        } catch (error) {
          console.log('🔧 Farcaster: Could not enumerate methods:', (error as any).message);
        }
      }
      
      // Second attempt: Try wagmi's native signTransaction if available
      if (walletClient && walletClient.signTransaction) {
        try {
          console.log('🔧 Farcaster: Using walletClient.signTransaction');
          const signedTx = await walletClient.signTransaction({
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}`,
            value: BigInt(transaction.value),
            gas: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
            gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined,
            nonce: transaction.nonce,
            chainId: Number(chainId),
          });
          
          console.log('🔧 Farcaster: ✅ Native transaction signing successful!');
          return signedTx;
          
        } catch (error) {
          console.log('🔧 Farcaster: Native transaction signing failed:', (error as any).message);
        }
      }
      
      console.log('🔧 Farcaster: Falling back to signature conversion approach...');
      
      // Alternative approach: Use the mathematical relationship between signatures
      const ethersTransaction = ethers.Transaction.from(transaction);
      const transactionHash = ethers.keccak256(ethersTransaction.unsignedSerialized);
      
      console.log('🔧 Farcaster: Raw transaction hash:', transactionHash);
      console.log('🔧 Farcaster: Attempting signature conversion approach...');
      
      // Get the message signature (this will have the Ethereum prefix)
      const messageSignature = await signMessageAsync({ message: transactionHash });
      
      // Parse the signature components
      const sigBytes = ethers.getBytes(messageSignature);
      const r = ethers.hexlify(sigBytes.slice(0, 32));
      const s = ethers.hexlify(sigBytes.slice(32, 64));
      
      console.log('🔧 Farcaster: Extracted signature components:', { r, s });
      
      // Try to construct a valid transaction signature using these r,s components
      // We'll test different recovery IDs to see if any produce the correct address
      for (let recoveryId = 0; recoveryId <= 3; recoveryId++) {
        try {
          const v = recoveryId + (Number(chainId) * 2 + 35); // EIP-155 v value
          
          console.log(`🔧 Farcaster: Testing recoveryId ${recoveryId}, v=${v}`);
          
          const testTransaction = ethers.Transaction.from(transaction);
          testTransaction.signature = { r, s, v };
          
          console.log(`🔧 Farcaster: Test transaction from: ${testTransaction.from}`);
          
          if (testTransaction.from?.toLowerCase() === address.toLowerCase()) {
            console.log(`🔧 Farcaster: ✅ Found working signature! recoveryId=${recoveryId}, v=${v}`);
            return testTransaction.serialized;
          }
          
        } catch (error) {
          console.log(`🔧 Farcaster: RecoveryId ${recoveryId} failed:`, (error as any).message);
        }
      }
      
      // If we get here, the signature conversion didn't work
      console.error('🔧 Farcaster: Could not find valid recovery parameters');
      console.log('🔧 Farcaster: This suggests the fundamental incompatibility between message and transaction signatures');
      throw new Error('Signature conversion failed - Farcaster may not support transaction signing');
      
      // Unreachable code removed - throw above always exits
      /* try {
        const parsedTx = ethers.Transaction.from(signedTx);
        console.log('🔧 Final transaction from:', parsedTx.from, 'Expected:', address);
        if (parsedTx.from?.toLowerCase() === address?.toLowerCase()) {
          console.log('🔧 Farcaster: ✅ Transaction signature verification passed!');
        } else {
          console.error('❌ WRONG SIGNER! Expected:', address || 'unknown', 'Got:', parsedTx.from);
        }
      } catch (parseError) {
        console.warn('🔧 Farcaster: Could not verify transaction signature:', parseError);
      }
      
      return signedTx; */
    };
    
    // Set up the callback for signContractTransaction using the shared signing function
    (provider as any).setSignContractTransactionCallback?.(async (params: any) => {
      console.log(`🔧 Farcaster: Provider CALLBACK called for ${params.debugLabel}`);
      try {
        return await signTransactionWithWagmi(params);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`🔧 Farcaster: Provider callback signing failed:`, errorMessage);
        throw new Error(`Provider callback signing failed: ${errorMessage}`);
      }
    });
    
    // Set up contract methods on the provider instance
    console.log('🔧 Farcaster: Setting up contract methods on provider instance');
    
    const contractMethods = createFarcasterContractMethods(
      signTransactionWithWagmi,
      (url: string, options?: RequestInit) => {
        // Use the BackendAuth instance for proper authenticated requests
        const backendAuth = BackendAuth.getInstance();
        console.log('🔧 Farcaster: Using BackendAuth.authenticatedFetch for:', url, 'hasToken:', !!backendAuth.getToken());
        return backendAuth.authenticatedFetch(url, options);
      },
      walletClient
    );
    
    (provider as any).setContractMethods?.(contractMethods);
  }, [provider, signMessageAsync, config, address, walletClient, walletConnected, connectors]);
  
  // Step 1: Initialize Farcaster SDK (singleton to prevent React Strict Mode duplicates)
  useEffect(() => {
    const initSDK = async () => {
      if (isSDKInitialized || (window as any).__farcasterSDK) {
        return;
      }
      
      console.log(`🔧 Farcaster [${innerInstanceId.current}]: Step 1 - SDK init`);
      isSDKInitialized = true;
      
      try {
        const farcasterModule = await import('@farcaster/miniapp-sdk');
        (window as any).__farcasterSDK = farcasterModule.sdk;
        
        // Check if we're actually in Farcaster
        const context = await farcasterModule.sdk.context;
        console.log('🔧 Farcaster: SDK context:', {
          hasUser: !!context?.user,
          fid: context?.user?.fid,
          custodyAddress: (context?.user as any)?.custodyAddress,
          verifiedAddresses: (context?.user as any)?.verifiedAddresses
        });
        
        // Check if wallet provider is available
        const hasWallet = typeof farcasterModule.sdk.wallet?.getEthereumProvider === 'function';
        console.log('🔧 Farcaster: Has wallet provider:', hasWallet);
        
        if (hasWallet) {
          const provider = await farcasterModule.sdk.wallet.getEthereumProvider();
          console.log('🔧 Farcaster: Wallet provider available:', !!provider);
        }
        
        console.log('🔧 Farcaster: Step 1 ✅');
      } catch (error) {
        console.error('🔧 Farcaster: SDK init failed:', error);
        isSDKInitialized = false;
      }
    };
    
    initSDK();
  }, []);

  // Step 2: QuickAuth - Get JWT token from Farcaster (singleton to prevent duplicates)
  useEffect(() => {
    const quickAuth = async () => {
      const sdk = (window as any).__farcasterSDK;
      if (!sdk) {
        return;
      }
      
      if (isQuickAuthInitialized || (window as any).__farcasterToken) {
        return;
      }
      
      console.log(`🔧 Farcaster [${innerInstanceId.current}]: Step 2 - QuickAuth`);
      isQuickAuthInitialized = true;
      
      try {
        const context = await sdk.context;
        if (context?.user) {
          // Wait longer for full context to load and Farcaster environment to be ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get JWT token with longer timeout - use singleton promise to prevent multiple calls
          if (!quickAuthPromise) {
            quickAuthPromise = Promise.race([
              sdk.quickAuth.getToken(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('QuickAuth timeout after 15 seconds')), 15000)
              )
            ]);
          }
          
          const authResponse = await quickAuthPromise;
          
          // Handle token response (can be string or object with token property)
          let token: string;
          if (typeof authResponse === 'string') {
            token = authResponse;
          } else if (authResponse && typeof authResponse === 'object' && 'token' in authResponse) {
            token = String((authResponse as any).token);
          } else {
            console.warn('🔧 Farcaster: QuickAuth - Invalid token format received:', authResponse);
            return;
          }
          
          // Validate JWT format
          if (!token || typeof token !== 'string' || !token.includes('.') || token.split('.').length !== 3) {
            console.warn('🔧 Farcaster: Invalid JWT token format');
            return;
          }
          
          (window as any).__farcasterToken = token;
          console.log('🔧 Farcaster: Step 2 ✅ - Token received');
        } else {
          console.log('🔧 Farcaster: Step 2 - No user context');
        }
      } catch (error) {
        console.error('🔧 Farcaster: Step 2 failed:', error);
        // Don't reset on timeout - might still succeed later
        if (!(error as any).message?.includes('timeout')) {
          isQuickAuthInitialized = false;
        }
      }
    };
    
    // Check immediately and then periodically until SDK is available - but stop once successful
    quickAuth();
    
    let interval: NodeJS.Timeout;
    let cleanup: NodeJS.Timeout;
    
    const checkForSDK = () => {
      const sdk = (window as any).__farcasterSDK;
      if (sdk && !isQuickAuthInitialized) {
        quickAuth();
        clearInterval(interval);
        clearTimeout(cleanup);
      }
    };
    
    interval = setInterval(checkForSDK, 100);
    
    // Cleanup after 5 seconds if still not found
    cleanup = setTimeout(() => {
      clearInterval(interval);
      console.log('🔧 Farcaster: Stopped checking for SDK after 5 seconds');
    }, 5000);
    
    return () => {
      if (interval) clearInterval(interval);
      if (cleanup) clearTimeout(cleanup);
    };
  }, []);

  // Step 3: Skip explicit wallet connection - let Wagmi connect automatically when signing
  // This prevents connecting to wrong wallet contexts in Farcaster environment

  // Step 4: Initialize provider AFTER wallet is connected
  useEffect(() => {
    if (!address || !walletConnected) {
      return;
    }

    const initProvider = async () => {
      console.log('🔧 Farcaster: Step 4 - Provider init');
      
      // Now initialize the provider with wallet address available
      await provider.initialize();
      // Update loading state so Step 5 can proceed, but don't mark as connected yet
      setAuthState(prev => ({ ...prev, isLoading: false }));
      console.log('🔧 Farcaster: Step 4 ✅');
    };
    
    initProvider();
  }, [address, walletConnected]);

  // Step 5: Final 'connect' step
  useEffect(() => {
    if (!provider.isReady() || !address || authState.isConnected || authState.isLoading) return;
    
    const finalConnect = async () => {
      const farcasterToken = (window as any).__farcasterToken;
      const farcasterSDK = (window as any).__farcasterSDK;
      
      console.log('🔧 Farcaster: Step 5 - Connect');
      
      if (farcasterToken && address && farcasterSDK) {
        try {
          // Use the Wagmi connected wallet address - this is the one that actually works for signing
          console.log('🔧 Farcaster: Using Wagmi connected wallet address:', address);
          
          // Get the Farcaster context addresses for logging/debugging
          const context = await farcasterSDK.context;
          const custodyAddress = context?.user?.custodyAddress;
          const verifiedAddresses = context?.user?.verifiedAddresses;
          
          console.log('🔧 Farcaster: Farcaster context addresses:', {
            custodyAddress,
            verifiedAddresses,
            usingWagmiAddress: address
          });
          
          // Set wallet address in provider - use the Wagmi address that actually works
          (provider as any).setWalletAddress(address);
          
          // Now perform the actual connection
          await provider.connect();
          
          // Update local auth state
          setAuthState(provider.getState());
          
          console.log('🔧 Farcaster: Step 5 ✅ - Connected!');
        } catch (error) {
          console.error('🔧 Farcaster: Step 5 failed:', error);
          setAuthState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Connection failed',
            isLoading: false
          }));
        }
      } else {
        console.warn('🔧 Farcaster: Missing prerequisites for final connect:', {
          token: !!farcasterToken,
          address: !!address,
          sdk: !!farcasterSDK
        });
      }
    };
    
    finalConnect();
    
    // Poll for token in case QuickAuth takes longer than expected - but stop once connected
    let pollInterval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    
    const startPolling = () => {
      pollInterval = setInterval(() => {
        const token = (window as any).__farcasterToken;
        if (token && !authState.isConnected) {
          console.log('🔧 Farcaster: Token now available, retrying connect...');
          finalConnect();
          // Stop polling after successful attempt
          clearInterval(pollInterval);
          clearTimeout(timeout);
        }
      }, 2000);
      
      // Stop polling after 30 seconds
      timeout = setTimeout(() => {
        clearInterval(pollInterval);
        console.log('🔧 Farcaster: Stopped polling for token after 30 seconds');
      }, 30000);
    };
    
    // Only start polling if we don't already have a token
    if (!(window as any).__farcasterToken) {
      startPolling();
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (timeout) clearTimeout(timeout);
    };
  }, [provider, address, authState.isConnected, authState.isLoading]);

  // Update auth state when wagmi wallet connects
  useEffect(() => {
    const handleEvent = (event: AuthEvent) => {
      setAuthState(provider.getState());
    };
    
    provider.on?.('connecting', handleEvent);
    provider.on?.('connected', handleEvent);
    provider.on?.('disconnected', handleEvent);
    provider.on?.('error', handleEvent);
    
    return () => {
      provider.off?.('connecting', handleEvent);
      provider.off?.('connected', handleEvent);
      provider.off?.('disconnected', handleEvent);
      provider.off?.('error', handleEvent);
    };
  }, [walletConnected, connectors]);
  
  // Update ENS name when available
  useEffect(() => {
    if (ensName && authState.user) {
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, ensName } : null
      }));
    }
  }, [ensName, authState.user]);
  
  // Auto-connect logic is now handled by Step 5 - removing redundant effect
  
  // Update wallet address in provider when connected
  useEffect(() => {
    if (address) {
      (provider as any).setWalletAddress(address);
    }
  }, [address]);
  
  // Note: Early return moved to after all hooks to comply with Rules of Hooks

  // Create contract transaction methods
  const contractMethods = React.useMemo(() => {
    console.log('🔧 Farcaster: Creating contract methods with:', {
      hasSignMessageAsync: !!signMessageAsync,
      hasAddress: !!address,
      hasWalletClient: !!walletClient,
      address
    });
    
    if (!signMessageAsync || !address) {
      console.log('🔧 Farcaster: Missing prerequisites for contract methods');
      return {};
    }

    const methods = createFarcasterContractMethods(
      async (params: any) => {
        // Transaction signing stub - will be replaced by the provider
        throw new Error('Transaction signing not available in this context');
      },
      (url: string, options?: RequestInit) => {
        // Use the authenticatedFetch from auth context if available
        // This ensures proper cookie handling
        return fetch(url, options);
      },
      walletClient  // Pass the wallet client for eth_sendTransaction
    );
    
    console.log('🔧 Farcaster: Contract methods created:', {
      hasFundContract: !!methods.fundContract,
      hasClaimFunds: !!methods.claimFunds,
      hasRaiseDispute: !!methods.raiseDispute,
      hasApproveUSDC: !!methods.approveUSDC,
      hasDepositFunds: !!methods.depositFunds,
      methodKeys: Object.keys(methods)
    });
    
    return methods;
  }, [signMessageAsync, address, walletClient]);
  
  // Force logging of current values
  React.useEffect(() => {
    console.log('🔧 Farcaster: Current hook values for contract methods:', {
      hasSignMessageAsync: !!signMessageAsync,
      hasAddress: !!address,
      hasWalletClient: !!walletClient,
      walletClientType: typeof walletClient,
      address,
      contractMethodsKeys: contractMethods ? Object.keys(contractMethods) : 'no contractMethods'
    });
  }, [signMessageAsync, address, walletClient, contractMethods]);

  // Only create our own context for standalone usage - memoize to prevent re-renders
  const contextValue: AuthContextType = React.useMemo(() => ({
    // State
    ...authState,
    
    // Methods for standalone usage
    connect: async () => {
      // No-op for Farcaster - connection happens automatically during 5-step sequence
      // This method exists only to satisfy the AuthContextType interface required by Web3Auth
    },
    
    disconnect: async () => {
      await provider.disconnect();
      await disconnectWallet();
      setAuthState(provider.getState());
    },
    
    getToken: provider.getToken.bind(provider),
    hasVisitedBefore: provider.hasVisitedBefore.bind(provider),
    markAsVisited: provider.markAsVisited.bind(provider),
    
    // Wallet operations (only available in Farcaster context with wagmi)
    signMessage: async (message: string) => {
      if (!signMessageAsync) {
        throw new Error('Sign message not available');
      }
      const signature = await signMessageAsync({ message });
      return signature;
    },
    
    getEthersProvider: () => {
      if (!config?.rpcUrl) {
        throw new Error('RPC URL not configured');
      }
      
      console.log('🔧 Farcaster: Creating simple JsonRpcProvider - signing handled by Wagmi separately');
      
      // Return simple ethers JsonRpcProvider for read operations
      // Signing is handled separately via Wagmi walletClient
      return new ethers.JsonRpcProvider(config.rpcUrl);
    },
    
    // Contract transaction signing using the working Wagmi pattern
    signContractTransaction: async (params: {
      contractAddress: string;
      abi: any[];
      functionName: string;
      functionArgs: any[];
      debugLabel?: string;
    }) => {
      console.log(`🔧 Farcaster: signContractTransaction DIRECT METHOD called for ${params.debugLabel}`);
      
      // This method should be overridden by the provider when available
      throw new Error('Transaction signing not available - ensure wallet is connected');
      // Unreachable code removed
      // The following code is unreachable due to throw above
      /* try {
        console.log(`🔧 Farcaster: ${params.debugLabel} signing transaction`);
        
        // Build the transaction object with proper parameters
          const jsonProvider = new ethers.JsonRpcProvider(config.rpcUrl);
          const nonce = await jsonProvider.getTransactionCount(address);
          const gasLimit = await jsonProvider.estimateGas({ 
            from: address,
            to: params.contractAddress,
            data 
          });
          // Get gas price via direct RPC call to avoid inflated values
          let gasPrice: bigint | null = null;
          try {
            const response = await fetch(config.rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_gasPrice',
                params: [],
                id: 1
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.result) {
                gasPrice = BigInt(result.result);
              }
            }
          } catch (error) {
            console.warn('Failed to get gas price from RPC in Farcaster:', error);
          }
          
          // Fallback to reasonable gas price if RPC fails
          if (!gasPrice) {
            gasPrice = BigInt('1000000000'); // 1 gwei fallback
          }
          const chainId = (await jsonProvider.getNetwork()).chainId;
          
          // Create the transaction object
          const transaction = {
            to: params.contractAddress,
            data,
            value: 0,
            gasLimit,
            gasPrice,
            nonce,
            chainId: Number(chainId),
            type: 0 // Legacy transaction type for compatibility
          };
          
          console.log('🔧 Farcaster: Transaction object:', transaction);
          
          // Create ethers Transaction and get the unsigned serialized bytes
          const ethersTransaction = ethers.Transaction.from(transaction);
          const unsignedTxBytes = ethersTransaction.unsignedSerialized;
          
          console.log('🔧 Farcaster: Unsigned transaction bytes:', unsignedTxBytes);
          
          console.log('🔧 Farcaster: Signing transaction bytes as message using signMessageAsync');
          const signature = await signMessageAsync({ message: unsignedTxBytes });
          
          // Verify who signed this message to confirm it's the right wallet  
          const recoveredAddress = ethers.verifyMessage(unsignedTxBytes, signature);
          console.log('🔧 Farcaster: Message signed by:', recoveredAddress, 'Expected:', address);
          
          // Parse signature into proper v, r, s components for transaction reconstruction
          const sigBytes = ethers.getBytes(signature);
          const r = ethers.hexlify(sigBytes.slice(0, 32));
          const s = ethers.hexlify(sigBytes.slice(32, 64));
          const recoveryId = sigBytes[64];
          
          // Try both possible recovery IDs to see which gives us the correct address
          console.log('🔧 Farcaster: Testing signature recovery...');
          let correctV = null;
          
          for (let testRecoveryId = 0; testRecoveryId <= 1; testRecoveryId++) {
            const testV = testRecoveryId + (Number(chainId) * 2 + 35);
            const testTransaction = ethers.Transaction.from(transaction);
            testTransaction.signature = { r, s, v: testV };
            
            console.log(`🔧 Farcaster: Testing recoveryId ${testRecoveryId}, v=${testV}, from=${testTransaction.from}`);
            
            if (testTransaction.from?.toLowerCase() === address.toLowerCase()) {
              console.log(`🔧 Farcaster: ✅ Found correct v value: ${testV}`);
              correctV = testV;
              break;
            }
          }
          
          if (!correctV) {
            console.error('🔧 Farcaster: Could not find correct recovery ID for transaction signature');
            throw new Error('Failed to reconstruct transaction with correct signer');
          }
          
          console.log('🔧 Farcaster: Using correct signature components:', { r, s, v: correctV, recoveryId, chainId });
          
          // Reconstruct transaction with proper signature (from address will be derived from signature)
          const signedTransaction = ethers.Transaction.from(transaction);
          signedTransaction.signature = { r, s, v: correctV };
          
          const signedTx = signedTransaction.serialized;
          console.log('🔧 Farcaster: Transaction reconstructed with proper signature');
          
          console.log(`🔧 Farcaster: ${params.debugLabel || 'Contract'} transaction signed on attempt ${attempt}`);
          console.log(`🔧 Farcaster: Signer address: ${address}`);
          
          // Verify the transaction signature
          try {
            const parsedTx = ethers.Transaction.from(signedTx);
            console.log(`🔧 Farcaster: Verified transaction signature - from: ${parsedTx.from}, expected: ${address}`);
            
            if (parsedTx.from?.toLowerCase() === address?.toLowerCase()) {
              console.log('🔧 Farcaster: ✅ Transaction signature verification passed!');
            } else {
              console.error('🔧 Farcaster: ❌ Transaction signature verification failed!');
            }
          } catch (parseError) {
            console.warn('🔧 Farcaster: Could not verify transaction signature:', parseError);
          }
          
          return signedTx;
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`🔧 Farcaster: ${params.debugLabel} signing failed:`, errorMessage);
          throw new Error(`Transaction signing failed: ${errorMessage}`);
        } */
    },
    
    // Blockchain operations
    getUSDCBalance: async (userAddress?: string) => {
      if (!config?.rpcUrl || !config?.usdcContractAddress) {
        console.warn('getUSDCBalance: RPC URL or USDC contract address not configured');
        return '0';
      }
      
      // Use JsonRpcProvider to read from blockchain
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const usdcContract = new ethers.Contract(
        config.usdcContractAddress,
        ERC20_ABI,
        provider
      );
      
      // Get balance for the requested address (or current user)
      const targetAddress = userAddress || address;
      if (!targetAddress) {
        console.warn('getUSDCBalance: No address available');
        return '0';
      }
      
      try {
        const balance = await usdcContract.balanceOf(targetAddress);
        return formatUnits(balance, 6); // USDC has 6 decimals
      } catch (error) {
        console.error('getUSDCBalance error:', error);
        return '0';
      }
    },

    // Transaction confirmation waiting (no-op for Farcaster since transactions are already confirmed)
    waitForTransaction: async (transactionHash: string, maxWaitTime?: number) => {
      // Farcaster transactions are already confirmed when they return
      console.log(`🔧 Farcaster: Transaction already confirmed: ${transactionHash}`);
      return Promise.resolve();
    },

    // High-level contract transaction methods (Farcaster-specific implementations)
    ...contractMethods,

    // Authenticated fetch with proper cookie handling
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return fetch(url, {
        ...options,
        credentials: 'include', // Ensure cookies are sent
        headers: {
          ...options?.headers,
        }
      });
    },
  }), [authState, address, signMessageAsync, walletClient, provider, connectors, config, contractMethods]);
  
  // Debug logging for context value - moved before return
  React.useEffect(() => {
    console.log('🔧 Farcaster: Context value debug:', {
      hasFundContract: !!contextValue.fundContract,
      hasClaimFunds: !!contextValue.claimFunds,
      hasRaiseDispute: !!contextValue.raiseDispute,
      hasContractMethods: !!contractMethods,
      contractMethodKeys: contractMethods ? Object.keys(contractMethods) : [],
      isConnected: contextValue.isConnected,
      hasAddress: !!contextValue.user?.walletAddress,
      contextKeys: Object.keys(contextValue),
      spreadWorking: contractMethods && Object.keys(contractMethods).length > 0
    });
  }, [contextValue, contractMethods]);
  
  // Early return after all hooks are called to comply with Rules of Hooks
  if (AuthContext) {
    return <>{children}</>;
  }
  
  return (
    <FarcasterAuthContext.Provider value={contextValue}>
      {children}
    </FarcasterAuthContext.Provider>
  );
}

/**
 * Farcaster Auth Provider React Component (with Wagmi setup)
 */
export function FarcasterAuthProvider({ children, AuthContext }: { 
  children: React.ReactNode;
  AuthContext?: React.Context<any>;
}) {
  const { config, isLoading } = useConfig();
  
  // Track instances for debugging (must be before any conditional returns)
  const instanceId = React.useRef(Math.random().toString(36).substr(2, 9));
  const renderCount = React.useRef(0);
  renderCount.current++;
  
  React.useEffect(() => {
    mainProviderInstanceCount++;
    console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: MOUNTED (total instances: ${mainProviderInstanceCount})`);
    
    return () => {
      mainProviderInstanceCount--;
      console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: UNMOUNTED (remaining instances: ${mainProviderInstanceCount})`);
    };
  }, []);
  
  // Wait for config to load before proceeding
  if (isLoading) {
    return <div>Loading configuration...</div>;
  }
  
  // Get chain ID from config - MUST be provided
  if (!config?.chainId) {
    throw new Error('CHAIN_ID must be configured - no default chain ID allowed');
  }
  const chainId = config.chainId;
  
  console.log(`🔧 FarcasterAuthProvider [${instanceId.current}]: RENDER #${renderCount.current} (chainId: ${chainId})`);
  
  // Use singleton instances to prevent multiple providers but allow proper React re-rendering
  const queryClient = getQueryClient();
  const wagmiConfig = getWagmiConfig(chainId);
  
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <FarcasterAuthProviderInner AuthContext={AuthContext}>
          {children}
        </FarcasterAuthProviderInner>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

/**
 * Hook to use Farcaster auth context
 */
export function useFarcasterAuth(): AuthContextType {
  const context = useContext(FarcasterAuthContext);
  if (!context) {
    throw new Error('useFarcasterAuth must be used within FarcasterAuthProvider');
  }
  return context;
}

/**
 * Component that displays Farcaster authentication data
 * Useful for debugging and testing
 */
export function FarcasterAuthDebug() {
  const auth = useFarcasterAuth();

  if (auth.isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-center mt-2">Loading Farcaster auth...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="p-4 border border-red-300 rounded bg-red-50">
        <p className="text-red-600">Error: {auth.error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded bg-white space-y-2">
      <h3 className="font-bold">Farcaster Auth Data:</h3>
      <div className="text-sm space-y-1">
        <p><strong>Wallet:</strong> {auth.user?.walletAddress || 'Not connected'}</p>
        <p><strong>FID:</strong> {auth.user?.fid || 'N/A'}</p>
        <p><strong>Username:</strong> @{auth.user?.username || 'N/A'}</p>
        <p><strong>Display Name:</strong> {auth.user?.displayName || 'N/A'}</p>
        <p><strong>ENS Name:</strong> {auth.user?.ensName || 'None'}</p>
        <p><strong>Profile Image:</strong> {auth.user?.profileImageUrl ? '✓' : '✗'}</p>
        <p><strong>Auth Token:</strong> {auth.token ? '✓ Valid JWT' : '✗ No token'}</p>
      </div>
    </div>
  );
}