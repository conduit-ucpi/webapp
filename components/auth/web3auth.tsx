import { Web3Auth } from "@web3auth/modal";
import { WALLET_ADAPTERS } from "@web3auth/base";
import { createWeb3AuthConfig } from "@/lib/web3authConfig";
import { BackendAuth } from "./backendAuth";
import { ethers } from "ethers";
import { mLog } from "@/utils/mobileLogger";

let web3authInstance: Web3Auth | null = null;

/**
 * Unified provider using Web3Auth Modal with all adapters
 * Includes social logins, WalletConnect, and direct wallet connections
 */
export function getWeb3AuthProvider(config: any) {
  const backendAuth = BackendAuth.getInstance();

  return {
    getProviderName: () => 'web3auth_unified',
    initialize: async () => {
      console.log('🔧 Unified provider: Initialize called');
      // Mobile redirect completion is handled by AuthManager.restoreSession()
    },
    dispose: async () => {
      if (web3authInstance) {
        console.log('🔧 Unified provider: Disposing Web3Auth instance');
        await web3authInstance.logout();
        web3authInstance = null;
      }
    },
    connect: async () => {
      mLog.info('Web3AuthProvider', 'Connect called - initializing Web3Auth modal with all adapters');
      mLog.debug('Web3AuthProvider', 'Current connection state', {
        url: window.location.href,
        web3authStatus: web3authInstance?.status,
        hasInstance: !!web3authInstance
      });

      try {
        // Initialize Web3Auth if not already done
        if (!web3authInstance) {
          console.log('🔧 Unified provider: Creating Web3Auth instance');


          const web3authConfig = createWeb3AuthConfig({
            ...config,
            walletConnectProjectId: config.walletConnectProjectId || process.env.WALLETCONNECT_PROJECT_ID
          });

          // Create Web3Auth instance with mobile-friendly options
          const web3authOptions = {
            ...web3authConfig.web3AuthOptions,
            // Pass chainConfig during initialization for mobile support
            chainConfig: web3authConfig.chainConfig,
          };


          web3authInstance = new Web3Auth(web3authOptions as any);


          // Initialize Web3Auth Modal with proper modalConfig to prevent auto-detection
          console.log('🔧 Unified provider: Initializing Web3Auth with modalConfig');

          // Use initModal() with modalConfig to hide external wallets on mobile
          const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);

          // Initialize Web3Auth - check if we can configure modal after init
          await web3authInstance.init();

          // For mobile, try to hide external wallets using the correct API for your version
          if (isMobile) {
            console.log('🔧 Unified provider: Mobile - attempting to hide external wallets');

            // Try different approaches for hiding external wallets
            try {
              // Method 1: Check if there's a way to configure adapters after init
              if (typeof (web3authInstance as any).hideAdapter === 'function') {
                (web3authInstance as any).hideAdapter('metamask');
                (web3authInstance as any).hideAdapter('torus-evm');
                console.log('🔧 Unified provider: Hidden external adapters using hideAdapter');
              }
              // Method 2: Check for other configuration methods
              else if (typeof (web3authInstance as any).configureModalSettings === 'function') {
                (web3authInstance as any).configureModalSettings({
                  showExternalWallets: false
                });
                console.log('🔧 Unified provider: Configured modal settings');
              }
            } catch (error) {
              console.warn('🔧 Unified provider: Could not hide external wallets:', error);
            }
          } else {
            console.log('🔧 Unified provider: Desktop - using all wallet options');
          }

          console.log('🔧 Unified provider: Web3Auth initialized successfully');
        }

        // Connect - force showing modal without auto-connection
        console.log('🔧 Unified provider: Opening Web3Auth modal');

        // Check if already connected (this might be causing auto-redirect)
        if (web3authInstance.connected) {
          console.log('🔧 Unified provider: Already connected, logging out first');
          await web3authInstance.logout();
        }

        // CRITICAL: Handle mobile vs desktop connection differently
        console.log('🔧 Unified provider: Connecting with Modal');

        const isMobileDevice = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
        let provider;

        if (isMobileDevice) {
          mLog.info('Web3AuthProvider', 'Mobile connection - checking for existing session first');
          mLog.debug('Web3AuthProvider', 'Web3Auth mobile state', {
            status: web3authInstance.status,
            hasProvider: !!web3authInstance.provider
          });

          // For mobile, check if we have redirect parameters indicating a completed auth
          const urlParams = new URLSearchParams(window.location.search);
          const hasAuthParams = urlParams.has('code') || urlParams.has('state') || urlParams.has('access_token');
          mLog.debug('Web3AuthProvider', 'Mobile URL analysis', {
            urlParams: urlParams.toString(),
            hasAuthParams,
            hasCode: urlParams.has('code'),
            hasState: urlParams.has('state'),
            hasAccessToken: urlParams.has('access_token')
          });

          // On mobile, check if we're already connected (returning from redirect)
          if (web3authInstance.status === 'connected' && web3authInstance.provider) {
            mLog.info('Web3AuthProvider', 'Already connected on mobile - using existing provider');
            provider = web3authInstance.provider;
          } else {
            mLog.info('Web3AuthProvider', 'Starting mobile connection');

            if (hasAuthParams) {
              mLog.info('Web3AuthProvider', 'Mobile redirect detected - attempting to complete authentication');
              // Web3Auth should automatically handle the redirect completion
              provider = await web3authInstance.connect();
            } else {
              mLog.info('Web3AuthProvider', 'Starting new mobile authentication flow');
              provider = await web3authInstance.connect();
            }
          }
        } else {
          provider = await web3authInstance.connect();
        }

        if (!provider) {
          throw new Error('No provider returned from Web3Auth');
        }

        mLog.info('Web3AuthProvider', 'Connected, getting user info');
        mLog.debug('Web3AuthProvider', 'Provider received', { hasProvider: !!provider });

        // Get user info and determine auth method
        const user = await web3authInstance.getUserInfo();
        mLog.debug('Web3AuthProvider', 'User info retrieved', {
          hasEmail: !!user.email,
          hasIdToken: !!user.idToken,
          name: user.name,
          verifier: (user as any).verifier
        });

        const ethersProvider = new ethers.BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const address = await signer.getAddress();
        mLog.debug('Web3AuthProvider', 'Address obtained', { address });

        let authToken: string;

        // Check if this is a social login (has email) or wallet connection
        if (user.email || user.idToken) {
          // Social login - use the idToken
          console.log('🔧 Unified provider: Social login detected, using idToken');
          authToken = user.idToken || `social:${address}`;
        } else {
          // Wallet connection - generate signature auth token
          console.log('🔧 Unified provider: Wallet connection detected, generating signature');
          const timestamp = Date.now();
          const nonce = Math.random().toString(36).substring(2, 15);
          const message = `Authenticate wallet ${address} at ${timestamp} with nonce ${nonce}`;
          const signature = await signer.signMessage(message);

          authToken = btoa(JSON.stringify({
            type: 'signature_auth',
            walletAddress: address,
            message,
            signature,
            timestamp,
            nonce,
            issuer: 'web3auth_unified'
          }));
        }

        // Authenticate with backend
        mLog.info('Web3AuthProvider', 'Authenticating with backend');
        mLog.debug('Web3AuthProvider', 'Backend auth request', {
          authTokenLength: authToken.length,
          address,
          authTokenType: user.email ? 'social' : 'signature'
        });

        const backendResult = await backendAuth.login(authToken, address);

        // Get the stored token from backendAuth
        const storedToken = backendAuth.getToken();

        mLog.debug('Web3AuthProvider', 'Backend auth result', {
          success: backendResult.success,
          hasStoredToken: !!storedToken,
          hasUser: !!backendResult.user,
          error: backendResult.error
        });

        if (!backendResult.success) {
          mLog.error('Web3AuthProvider', 'Backend auth failed', { error: backendResult.error });
          const errorResult = {
            success: false,
            error: backendResult.error || 'Backend authentication failed'
          };
          await mLog.forceFlush(); // Flush logs before returning error
          return errorResult;
        }

        mLog.info('Web3AuthProvider', '✅ Successfully connected and authenticated');

        // Store the provider for later use
        // Return the expected result format for AuthManager
        const result = {
          success: true,
          provider: provider,
          token: storedToken,
          user: backendResult.user
        };
        mLog.debug('Web3AuthProvider', 'Returning success result', {
          success: result.success,
          hasProvider: !!result.provider,
          hasToken: !!result.token,
          hasUser: !!result.user
        });

        // Force flush logs on success
        await mLog.forceFlush();
        return result;

      } catch (error) {
        mLog.error('Web3AuthProvider', 'Connection failed', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        // Return error result instead of throwing
        const errorResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed'
        };
        mLog.debug('Web3AuthProvider', 'Returning error result', errorResult);

        // Force flush logs on error
        await mLog.forceFlush();
        return errorResult;
      }
    },
    disconnect: async () => {
      await backendAuth.logout();

      // Clear Web3Service singleton to ensure fresh provider on next login
      try {
        const { Web3Service } = await import('@/lib/web3');
        Web3Service.clearInstance();
        console.log('🔧 Unified provider: Cleared Web3Service singleton');
      } catch (error) {
        console.warn('Could not clear Web3Service singleton:', error);
      }

      if (web3authInstance) {
        console.log('🔧 Unified provider: Disconnecting Web3Auth');
        await web3authInstance.logout();
        web3authInstance = null;
      }
    },
    getToken: () => backendAuth.getToken(),
    signMessage: async (message: string) => {
      if (web3authInstance?.provider) {
        const ethersProvider = new ethers.BrowserProvider(web3authInstance.provider);
        const signer = await ethersProvider.getSigner();
        return await signer.signMessage(message);
      }
      throw new Error('No provider available for signing');
    },
    getEthersProvider: async () => {
      if (web3authInstance?.provider) {
        return new ethers.BrowserProvider(web3authInstance.provider);
      }
      return null;
    },
    showWalletUI: async () => {
      if (web3authInstance) {
        try {
          console.log('🔧 Unified provider: Opening Web3Auth wallet services UI');
          // Check if showWalletUi method exists on the instance
          if (typeof (web3authInstance as any).showWalletUi === 'function') {
            await (web3authInstance as any).showWalletUi({ show: true });
          } else {
            throw new Error('showWalletUi method not available on this Web3Auth instance. Please ensure you are using Web3Auth Modal SDK v10+.');
          }
        } catch (error) {
          console.error('🔧 Unified provider: Failed to show wallet UI:', error);
          throw error;
        }
      } else {
        throw new Error('Web3Auth not initialized - cannot show wallet UI');
      }
    },
    signContractTransaction: async () => '',
    hasVisitedBefore: () => {
      try {
        return !!localStorage.getItem('conduit-has-visited');
      } catch {
        return false;
      }
    },
    markAsVisited: () => {
      try {
        localStorage.setItem('conduit-has-visited', 'true');
      } catch {}
    },
    isReady: true,
    isConnected: () => {
      return !!web3authInstance?.connected;
    },
    getUserInfo: () => {
      return web3authInstance?.getUserInfo();
    },
    getState: () => ({
      user: null,
      token: backendAuth.getToken(),
      isConnected: !!web3authInstance?.connected,
      isLoading: false,
      isInitialized: true,
      error: null,
      providerName: 'web3auth_unified'
    })
  };
}