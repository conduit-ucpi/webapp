import React, { useState, useEffect } from 'react';
import { useFarcaster } from '@/components/farcaster/FarcasterDetectionProvider';
import { useConfig } from './ConfigProvider';
import { AuthContextType, AuthState, IAuthProvider, AuthUser } from './authInterface';
import { BackendAuth } from './backendAuth';
import { Web3Service } from '@/lib/web3';

// The unified context that the rest of the app uses
const AuthContext = React.createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isInFarcaster, isLoading: envDetectionLoading } = useFarcaster();
  const { config, isLoading: configLoading } = useConfig();
  const [provider, setProvider] = useState<IAuthProvider | null>(null);
  const [web3Service, setWeb3Service] = useState<Web3Service | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'loading'
  });
  
  // Get backend auth instance
  const backendAuth = BackendAuth.getInstance();
  
  // Track AuthProvider renders
  const authProviderId = React.useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔧 AuthProvider [${authProviderId.current}]: Render - Farcaster: ${isInFarcaster}`);
  
  // Load the appropriate provider based on environment
  useEffect(() => {
    if (!isInFarcaster && (configLoading || !config)) return;

    const loadProvider = async () => {
      try {
        if (isInFarcaster) {
          // Load Farcaster provider
          console.log('🔧 AuthProvider: Loading Farcaster provider...');
          const { getFarcasterAuthProvider } = await import('./farcasterAuth');
          const authProvider = getFarcasterAuthProvider();
          await authProvider.initialize();
          setProvider(authProvider);
          setAuthState(authProvider.getState());
        } else {
          // Load Web3Auth no-modal provider
          console.log('🔧 AuthProvider: Loading Web3Auth no-modal provider...');
          const { getWeb3AuthNoModalProvider } = await import('./web3authNoModal');
          const authProvider = getWeb3AuthNoModalProvider(config!);
          
          try {
            await authProvider.initialize();
            console.log('🔧 AuthProvider: Web3Auth provider initialized successfully');
          } catch (initError) {
            console.error('🔧 AuthProvider: Failed to initialize Web3Auth:', initError);
            // Even if initialization fails, set the provider so user can see error
            // The provider will handle the error state internally
          }
          
          setProvider(authProvider);
          
          // Check if we have an existing backend session
          const backendStatus = await backendAuth.checkAuthStatus();
          
          if (backendStatus.success && backendStatus.user) {
            const providerState = authProvider.getState();
            if (providerState.user) {
              providerState.user = {
                ...providerState.user,
                ...backendStatus.user
              } as AuthUser;
            }
            providerState.isConnected = true;
            setAuthState(providerState);
          } else {
            setAuthState(authProvider.getState());
          }
        }
      } catch (error) {
        console.error('🔧 AuthProvider: Error loading provider:', error);
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load auth provider',
          isLoading: false
        }));
      }
    };

    loadProvider();
  }, [isInFarcaster, config, configLoading, backendAuth]);

  // Monitor provider state for connection and handle backend auth + Web3Service initialization
  useEffect(() => {
    if (!provider || !authState.isConnected || !config) return;
    
    console.log('🔧 AuthProvider: Checking if backend auth and Web3Service initialization needed...', {
      hasProvider: !!provider,
      isConnected: authState.isConnected,
      hasUserId: !!authState.user?.userId,
      hasBackendToken: !!backendAuth.getToken(),
      hasWeb3Service: !!web3Service
    });
    
    // Initialize Web3Service with EIP-1193 provider if not already done
    const initializeWeb3Service = async () => {
      if (!web3Service) {
        try {
          console.log('[AuthProvider] Initializing Web3Service with EIP-1193 provider...');
          
          // Get the raw EIP-1193 provider from the auth provider
          let eip1193Provider: any;
          
          // Different auth providers expose the EIP-1193 provider differently
          const authProviderImpl = provider as any;
          
          if (authProviderImpl.provider) {
            // Web3Auth and most providers store it as 'provider'
            eip1193Provider = authProviderImpl.provider;
            console.log('[AuthProvider] Found EIP-1193 provider at authProvider.provider');
          } else if (authProviderImpl.getProvider && typeof authProviderImpl.getProvider === 'function') {
            // Some providers might expose it via a method
            eip1193Provider = authProviderImpl.getProvider();
            console.log('[AuthProvider] Got EIP-1193 provider via authProvider.getProvider()');
          } else if (authProviderImpl.web3Provider) {
            // Alternative naming
            eip1193Provider = authProviderImpl.web3Provider;
            console.log('[AuthProvider] Found EIP-1193 provider at authProvider.web3Provider');
          } else {
            console.warn('[AuthProvider] Could not find raw EIP-1193 provider, auth provider structure:', {
              keys: Object.keys(authProviderImpl),
              type: authProviderImpl.constructor?.name
            });
            return;
          }
          
          if (eip1193Provider) {
            // Create and initialize Web3Service with the EIP-1193 provider
            const newWeb3Service = new Web3Service(config);
            await newWeb3Service.initializeWithEIP1193(eip1193Provider);
            setWeb3Service(newWeb3Service);
            console.log('[AuthProvider] ✅ Web3Service initialized with EIP-1193 provider');
            
            // Store it globally for backward compatibility (some components might access it directly)
            (window as any).web3Service = newWeb3Service;
          }
        } catch (error) {
          console.error('[AuthProvider] ❌ Failed to initialize Web3Service:', error);
        }
      }
    };
    
    // Skip if we already have backend auth
    if (backendAuth.getToken()) {
      console.log('🔧 AuthProvider: Backend token already exists, skipping backend auth');
      initializeWeb3Service();
      return;
    }
    
    // Provider just connected - call backend auth
    const handleBackendAuth = async () => {
      console.log('🔧 AuthProvider: Provider connected, calling backend auth...');
      
      const providerState = provider.getState();
      const token = provider.getToken();
      
      console.log('🔧 AuthProvider: Provider data:', {
        hasToken: !!token,
        hasWalletAddress: !!providerState.user?.walletAddress,
        userDetails: providerState.user
      });
      
      if (token && providerState.user?.walletAddress) {
        console.log('🔧 AuthProvider: Calling backendAuth.login...', {
          hasIdToken: !!token,
          authProvider: providerState.user.authProvider,
          tokenLength: token.length
        });
        const backendResult = await backendAuth.login(
          token,
          providerState.user.walletAddress
        );
        
        if (backendResult.success && backendResult.user) {
          console.log('🔧 AuthProvider: Backend auth successful!');
          // Merge backend user data with provider user data
          const newState = { ...providerState };
          if (newState.user) {
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user.fid,
              username: newState.user.username,
              displayName: newState.user.displayName || backendResult.user.email,
            } as AuthUser;
          }
          setAuthState(newState);
          
          // Initialize Web3Service after successful backend auth
          await initializeWeb3Service();
        } else if (backendResult.error?.includes('TEMP_SKIP_AUTH') || token === 'TEMP_SKIP_AUTH') {
          // Legacy temporary auth - try signature authentication with unified Web3Service
          console.log('🔧 AuthProvider: Detected temp auth, attempting signature authentication...');
          try {
            if (web3Service) {
              const signatureToken = await web3Service.generateSignatureAuthToken();
              
              // Retry backend auth with signature token
              const signatureBackendResult = await backendAuth.login(
                signatureToken,
                providerState.user?.walletAddress || ''
              );
              
              if (signatureBackendResult.success && signatureBackendResult.user) {
                console.log('🔧 AuthProvider: ✅ Signature authentication successful!');
                const newState = { ...providerState };
                if (newState.user) {
                  newState.user = {
                    ...newState.user,
                    ...signatureBackendResult.user,
                    fid: newState.user.fid,
                    username: newState.user.username,
                    displayName: newState.user.displayName || signatureBackendResult.user.email,
                  } as AuthUser;
                }
                setAuthState(newState);
                return; // Exit early on success
              }
            }
          } catch (signatureError) {
            console.error('🔧 AuthProvider: ❌ Signature authentication failed:', signatureError);
          }
          
          // If signature auth failed, show error
          setAuthState(prev => ({
            ...prev,
            error: 'Authentication failed - unable to verify wallet ownership',
            isConnected: false
          }));
        } else {
          console.error('🔧 AuthProvider: Backend auth failed:', backendResult.error);
          setAuthState(prev => ({
            ...prev,
            error: backendResult.error || 'Backend authentication failed',
            isConnected: false
          }));
        }
      } else {
        console.error('🔧 AuthProvider: Missing token or wallet address for backend auth', {
          hasToken: !!token,
          hasWalletAddress: !!providerState.user?.walletAddress
        });
      }
    };
    
    handleBackendAuth();
  }, [provider, authState.isConnected, backendAuth, config, web3Service]);


  // Create the unified context value - memoize to prevent re-renders (must be before early returns)
  const contextValue: AuthContextType = React.useMemo(() => {
    if (!provider) {
      // Return minimal context when provider not loaded
      return {
        ...authState,
        connect: async () => { throw new Error('Auth provider not initialized'); },
        disconnect: async () => { throw new Error('Auth provider not initialized'); },
        getToken: () => null,
        hasVisitedBefore: () => false,
        markAsVisited: () => {},
        signMessage: async () => { throw new Error('Auth provider not initialized'); },
        signContractTransaction: async () => { throw new Error('Auth provider not initialized'); },
        getEthersProvider: () => { throw new Error('Auth provider not initialized'); },
        getUSDCBalance: async () => '0',
        authenticatedFetch: undefined,
      };
    }
    
    return ({
    // State
    ...authState,

    // Methods - delegate to the loaded provider
    connect: async (loginHint?: string) => {
      try {
        // First connect to the auth provider (Web3Auth)
        await provider.connect();
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (newState.token && newState.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            newState.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    disconnect: async () => {
      // Logout from backend first
      await backendAuth.logout();
      
      // Then disconnect from provider
      await provider.disconnect();
      setAuthState(provider.getState());
    },

    getToken: () => provider.getToken(),
    
    hasVisitedBefore: () => provider.hasVisitedBefore(),
    
    markAsVisited: () => provider.markAsVisited(),

    signMessage: async (message: string) => {
      // Cast to access signMessage method
      const providerWithSign = provider as any;
      if (providerWithSign.signMessage) {
        return await providerWithSign.signMessage(message);
      }
      throw new Error('Sign message not available');
    },

    getEthersProvider: () => {
      // If we have a unified Web3Service, use it
      if (web3Service && (web3Service as any).provider) {
        console.log('[AuthProvider] Returning ethers provider from Web3Service');
        return (web3Service as any).provider;
      }
      
      // Fallback to auth provider's method
      const providerWithEthers = provider as any;
      if (providerWithEthers.getEthersProvider) {
        console.log('[AuthProvider] Returning ethers provider from auth provider');
        return providerWithEthers.getEthersProvider();
      }
      throw new Error('Ethers provider not available');
    },
    
    // Expose Web3Service for direct access when needed
    getWeb3Service: () => web3Service,
    
    // Generate signature-based authentication token
    generateSignatureAuthToken: async () => {
      if (web3Service) {
        console.log('[AuthProvider] Generating signature auth token via Web3Service...');
        return await web3Service.generateSignatureAuthToken();
      }
      throw new Error('Web3Service not available for signature authentication');
    },

    getUSDCBalance: async (userAddress?: string) => {
      // Cast to access getUSDCBalance method
      const providerWithUSDC = provider as any;
      if (providerWithUSDC.getUSDCBalance) {
        return await providerWithUSDC.getUSDCBalance(userAddress);
      }
      throw new Error('getUSDCBalance not available');
    },

    signContractTransaction: async (params: any) => {
      // Cast to access signContractTransaction method
      const providerWithSign = provider as any;
      if (providerWithSign.signContractTransaction) {
        return await providerWithSign.signContractTransaction(params);
      }
      throw new Error('signContractTransaction not available');
    },

    // High-level contract transaction methods
    createContract: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.createContract) {
        return await providerWithContract.createContract(...args);
      }
      throw new Error('createContract not available');
    },

    approveUSDC: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.approveUSDC) {
        return await providerWithContract.approveUSDC(...args);
      }
      throw new Error('approveUSDC not available');
    },

    depositFunds: async (...args: any[]) => {
      const providerWithContract = provider as any;
      if (providerWithContract.depositFunds) {
        return await providerWithContract.depositFunds(...args);
      }
      throw new Error('depositFunds not available');
    },

    fundContract: async (...args: any[]) => {
      console.log('🔧 AuthProvider: fundContract called, using shared contract service');
      
      // Use shared contract service with current provider for transactions
      const { createContractTransactionMethods } = await import('../../utils/contractTransactionFactory');
      
      // Get the actual provider for low-level operations
      const actualProvider = (provider as any).getActualProvider ? (provider as any).getActualProvider() : provider;
      
      if (!actualProvider.signContractTransaction || !actualProvider.fundAndSendTransaction) {
        throw new Error('Provider does not support required transaction methods');
      }
      
      const contractMethods = createContractTransactionMethods(
        actualProvider.signContractTransaction.bind(actualProvider),
        backendAuth.authenticatedFetch,
        actualProvider.fundAndSendTransaction.bind(actualProvider)
      );
      
      return await contractMethods.fundContract(args[0]);
    },

    claimFunds: async (...args: any[]) => {
      console.log('🔧 AuthProvider: claimFunds called, using shared contract service');
      
      // Use shared contract service with current provider for transactions
      const { createContractTransactionMethods } = await import('../../utils/contractTransactionFactory');
      
      // Get the actual provider for low-level operations
      const actualProvider = (provider as any).getActualProvider ? (provider as any).getActualProvider() : provider;
      
      if (!actualProvider.signContractTransaction || !actualProvider.fundAndSendTransaction) {
        throw new Error('Provider does not support required transaction methods');
      }
      
      const contractMethods = createContractTransactionMethods(
        actualProvider.signContractTransaction.bind(actualProvider),
        backendAuth.authenticatedFetch,
        actualProvider.fundAndSendTransaction.bind(actualProvider)
      );
      
      return await contractMethods.claimFunds(args[0], args[1]);
    },

    raiseDispute: async (...args: any[]) => {
      console.log('🔧 AuthProvider: raiseDispute called, using shared contract service');
      
      // Use shared contract service with current provider for transactions
      const { createContractTransactionMethods } = await import('../../utils/contractTransactionFactory');
      
      // Get the actual provider for low-level operations
      const actualProvider = (provider as any).getActualProvider ? (provider as any).getActualProvider() : provider;
      
      if (!actualProvider.signContractTransaction || !actualProvider.fundAndSendTransaction) {
        throw new Error('Provider does not support required transaction methods');
      }
      
      const contractMethods = createContractTransactionMethods(
        actualProvider.signContractTransaction.bind(actualProvider),
        backendAuth.authenticatedFetch,
        actualProvider.fundAndSendTransaction.bind(actualProvider)
      );
      
      return await contractMethods.raiseDispute(args[0]);
    },
    
    // No-modal specific method for connecting with specific adapters
    connectWithAdapter: async (adapter: string, loginHint?: string) => {
      try {
        // Check if provider has connectWithAdapter method
        const providerWithAdapter = provider as any;
        if (!providerWithAdapter.connectWithAdapter) {
          // Fall back to regular connect for providers that don't support adapters
          await provider.connect();
          return;
        }
        
        // First connect to the auth provider (Web3Auth)
        const authResult = await providerWithAdapter.connectWithAdapter(adapter, loginHint);
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (authResult.success && newState.token && authResult.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            authResult.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed  
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    // Use BackendAuth for authenticated API calls
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return backendAuth.authenticatedFetch(url, options);
    },

    // Refresh user data from backend
    refreshUserData: async () => {
      try {
        const backendStatus = await backendAuth.checkAuthStatus();
        if (backendStatus.success && backendStatus.user) {
          setAuthState(prev => ({
            ...prev,
            user: prev.user ? {
              ...prev.user,
              ...backendStatus.user
            } : backendStatus.user as any
          }));
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    },

    // Debug methods
    clearStoredToken: () => {
      backendAuth.clearToken();
    },
    clearAllAuthState: () => {
      backendAuth.clearAllAuthState();
    },
    getAuthToken: () => {
      return backendAuth.getToken();
    },
    });
  }, [authState, provider, backendAuth, web3Service]);

  // Memoize callbacks to prevent FarcasterAuthProviderWrapper re-renders (must be before early returns)
  const handleProviderReady = React.useCallback((p: IAuthProvider) => {
    setProvider(p);
  }, []);
  
  const handleStateChange = React.useCallback((state: AuthState) => {
    setAuthState(state);
  }, []);

  // Early returns after all hooks
  
  // Still detecting environment
  if (envDetectionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Detecting environment...</p>
        </div>
      </div>
    );
  }

  // Show loading for Web3Auth while provider loads
  if (!isInFarcaster && (configLoading || !config || !provider)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {isInFarcaster ? (
        <FarcasterAuthProviderWrapper 
          onProviderReady={handleProviderReady}
          onStateChange={handleStateChange}
        >
          {children}
        </FarcasterAuthProviderWrapper>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

// Wrapper that loads and renders FarcasterAuthProvider
const FarcasterAuthProviderWrapper = React.memo(function FarcasterAuthProviderWrapper({ 
  children, 
  onProviderReady,
  onStateChange 
}: { 
  children: React.ReactNode;
  onProviderReady?: (provider: IAuthProvider) => void;
  onStateChange?: (state: AuthState) => void;
}) {
  const [FarcasterComponent, setFarcasterComponent] = useState<any>(null);
  
  // Track wrapper renders
  const wrapperId = React.useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔧 FarcasterAuthProviderWrapper [${wrapperId.current}]: RENDERING`);
  
  // Poll for Farcaster provider state changes - but stop once connected
  useEffect(() => {
    if (!FarcasterComponent) return;
    
    let checkFarcasterState: NodeJS.Timeout;
    let hasConnected = false;
    
    const checkState = () => {
      // Check if Farcaster provider exists and has connected
      const farcasterProvider = (window as any).__farcasterProvider;
      if (farcasterProvider && onProviderReady) {
        onProviderReady(farcasterProvider);
        
        const state = farcasterProvider.getState();
        if (state.isConnected && onStateChange && !hasConnected) {
          console.log('🔧 FarcasterWrapper: Farcaster connected, updating parent state');
          hasConnected = true;
          onStateChange(state);
          // Stop polling once connected
          if (checkFarcasterState) {
            clearInterval(checkFarcasterState);
          }
        }
      }
    };
    
    checkFarcasterState = setInterval(checkState, 500);
    
    return () => {
      if (checkFarcasterState) {
        clearInterval(checkFarcasterState);
      }
    };
  }, [FarcasterComponent, onProviderReady, onStateChange]);
  
  useEffect(() => {
    const loadFarcaster = async () => {
      console.log('🔧 FarcasterWrapper: Loading FarcasterAuthProvider...');
      try {
        const { FarcasterAuthProvider, getFarcasterAuthProvider } = await import('./farcasterAuth');
        
        // Store the provider instance globally so we can access it
        const provider = getFarcasterAuthProvider();
        (window as any).__farcasterProvider = provider;
        
        setFarcasterComponent(() => FarcasterAuthProvider);
      } catch (error) {
        console.error('🔧 FarcasterWrapper: Failed to load:', error);
      }
    };
    loadFarcaster();
  }, []);
  
  if (!FarcasterComponent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Farcaster authentication...</p>
        </div>
      </div>
    );
  }
  
  // Pass the AuthContext to FarcasterAuthProvider so it uses the same context
  return React.createElement(FarcasterComponent, { AuthContext }, children);
});

// Component for regular (non-Farcaster) authentication - REMOVED (no longer needed)
// The main AuthProvider handles all authentication methods now
/*
function RegularAuthProvider({ children }: AuthProviderProps) {
  const { config, isLoading: configLoading } = useConfig();
  const [provider, setProvider] = useState<IAuthProvider | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isConnected: false,
    isLoading: true,
    isInitialized: false,
    error: null,
    providerName: 'loading'
  });
  
  // Get backend auth instance
  const backendAuth = BackendAuth.getInstance();

  // Load Web3Auth provider
  useEffect(() => {
    if (configLoading || !config) return;

    const loadProvider = async () => {
      try {
        console.log('🔧 RegularAuthProvider: Loading Web3Auth provider...');
        const { getWeb3AuthProvider } = await import('./web3auth');
        const authProvider = getWeb3AuthProvider(config);

        await authProvider.initialize();
        setProvider(authProvider);
        
        // Check if we have an existing backend session
        const backendStatus = await backendAuth.checkAuthStatus();
        
        if (backendStatus.success && backendStatus.user) {
          const providerState = authProvider.getState();
          if (providerState.user) {
            providerState.user = {
              ...providerState.user,
              ...backendStatus.user,
              authProvider: providerState.user.authProvider || 'unknown'
            } as AuthUser;
          }
          providerState.isConnected = true;
          setAuthState(providerState);
        } else {
          setAuthState(authProvider.getState());
        }
        
      } catch (error) {
        console.error('🔧 RegularAuthProvider: Error loading provider:', error);
        setAuthState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load auth provider',
          isLoading: false
        }));
      }
    };

    loadProvider();
  }, [config, configLoading, backendAuth]);

  // Show loading while we load the provider
  if (configLoading || !config || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Create the context value that implements AuthContextType
  const contextValue: AuthContextType = {
    // State
    ...authState,

    // Methods - delegate to the loaded provider
    connect: async () => {
      try {
        // First connect to the auth provider (Web3Auth)
        const authResult = await provider.connect();
        const newState = provider.getState();
        
        // If we got a token and wallet address, verify with backend
        if (newState.token && newState.user?.walletAddress) {
          const backendResult = await backendAuth.login(
            newState.token,
            newState.user.walletAddress
          );
          
          if (backendResult.success && backendResult.user) {
            // Merge backend user data with provider user data
            newState.user = {
              ...newState.user,
              ...backendResult.user,
              // Keep provider-specific fields
              fid: newState.user?.fid,
              username: newState.user?.username,
              displayName: newState.user?.displayName || backendResult.user.email,
              authProvider: newState.user?.authProvider || 'unknown',
            } as AuthUser;
          } else {
            // Backend verification failed
            newState.error = backendResult.error || 'Backend authentication failed';
            newState.isConnected = false;
          }
        }
        
        setAuthState(newState);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        setAuthState(prev => ({
          ...prev,
          error: errorMessage,
          isConnected: false,
          isLoading: false
        }));
        throw error;
      }
    },

    disconnect: async () => {
      // Logout from backend first
      await backendAuth.logout();
      
      // Then disconnect from provider
      await provider.disconnect();
      setAuthState(provider.getState());
    },

    getToken: () => provider.getToken(),
    
    hasVisitedBefore: () => provider.hasVisitedBefore(),
    
    markAsVisited: () => provider.markAsVisited(),

    signMessage: async (message: string) => {
      // Cast to access signMessage method
      const providerWithSign = provider as any;
      if (providerWithSign.signMessage) {
        return await providerWithSign.signMessage(message);
      }
      throw new Error('Sign message not available');
    },

    getEthersProvider: () => {
      // If we have a unified Web3Service, use it
      if (web3Service && (web3Service as any).provider) {
        console.log('[AuthProvider] Returning ethers provider from Web3Service');
        return (web3Service as any).provider;
      }
      
      // Fallback to auth provider's method
      const providerWithEthers = provider as any;
      if (providerWithEthers.getEthersProvider) {
        console.log('[AuthProvider] Returning ethers provider from auth provider');
        return providerWithEthers.getEthersProvider();
      }
      throw new Error('Ethers provider not available');
    },
    
    // Expose Web3Service for direct access when needed
    getWeb3Service: () => web3Service,
    
    getUSDCBalance: async (userAddress?: string) => {
      const providerWithBalance = provider as any;
      if (providerWithBalance.getUSDCBalance) {
        return await providerWithBalance.getUSDCBalance(userAddress);
      }
      return '0';
    },
    
    signContractTransaction: async (params: any) => {
      const providerWithSign = provider as any;
      if (providerWithSign.signContractTransaction) {
        return await providerWithSign.signContractTransaction(params);
      }
      throw new Error('Contract transaction signing not available');
    },
    
    // Use BackendAuth for authenticated API calls
    authenticatedFetch: (url: string, options?: RequestInit) => {
      return backendAuth.authenticatedFetch(url, options);
    },

    // Debug methods
    clearStoredToken: () => {
      backendAuth.clearToken();
    },
    clearAllAuthState: () => {
      backendAuth.clearAllAuthState();
    },
    getAuthToken: () => {
      return backendAuth.getToken();
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
*/

// The ONLY hook the rest of the app should use
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}