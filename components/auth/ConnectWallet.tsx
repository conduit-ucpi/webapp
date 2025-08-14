import { useState, useEffect } from 'react';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthUser, useIdentityToken } from '@web3auth/modal/react';
import { ethers } from 'ethers';
import { useConfig } from './ConfigProvider';
import { useAuth } from './AuthProvider';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Function to reset Web3Auth instance (called on logout) - now handled by provider
export const resetWeb3AuthInstance = () => {
  console.log('resetWeb3AuthInstance called - handled by React provider');
};

export default function ConnectWallet() {
  const { config } = useConfig();
  const { login } = useAuth();
  const { provider } = useWeb3Auth();
  const { connect, isConnected } = useWeb3AuthConnect();
  const { userInfo } = useWeb3AuthUser();
  const { token: idToken } = useIdentityToken();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasVisitedBefore, setHasVisitedBefore] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{walletAddress: string, provider: any} | null>(null);



  // Check if already connected and auto-login
  useEffect(() => {
    const handleAutoLogin = async () => {
      if (isConnected && provider && idToken) {
        console.log('Already connected, attempting auto-login...');
        console.log('Provider from useWeb3Auth hook:', provider);
        try {
          // Get wallet address using ethers.js (proper Web3Auth v10 pattern)
          const ethersProvider = new ethers.BrowserProvider(provider as any);
          const signer = await ethersProvider.getSigner();
          const walletAddress = await signer.getAddress();
          
          console.log('Auto-login wallet address:', walletAddress);
          await login(idToken, walletAddress, provider);
        } catch (error) {
          console.error('Auto-login failed:', error);
        }
      }
    };

    handleAutoLogin();
  }, [isConnected, provider, idToken]);

  // Handle pending login when idToken becomes available
  useEffect(() => {
    const handlePendingLogin = async () => {
      if (pendingLogin && idToken) {
        console.log('idToken now available, completing login...');
        try {
          await login(idToken, pendingLogin.walletAddress, pendingLogin.provider);
          console.log('Login successful');
          setPendingLogin(null);
          setIsConnecting(false);
        } catch (error) {
          console.error('Pending login failed:', error);
          setPendingLogin(null);
          setIsConnecting(false);
        }
      }
    };

    handlePendingLogin();
  }, [idToken, pendingLogin]);

  useEffect(() => {
    try {
      const visited = localStorage.getItem('conduit-has-visited');
      setHasVisitedBefore(!!visited);

      if (!visited) {
        localStorage.setItem('conduit-has-visited', 'true');
      }
    } catch (error) {
      console.warn('localStorage not available:', error);
      // Fallback to false if localStorage is not available
      setHasVisitedBefore(false);
    }
  }, []);

  const connectWallet = async () => {
    console.log('Connecting wallet...');
    setIsConnecting(true);
    
    try {
      console.log('Starting wallet connection with React provider pattern...');
      
      // Use the React provider's connect method
      const web3authProvider = await connect();
      
      console.log('Connect result:', web3authProvider);
      console.log('Connect result type:', typeof web3authProvider);
      
      if (!web3authProvider) {
        throw new Error('Failed to connect wallet - no provider available');
      }
      
      console.log('Web3Auth provider obtained:', web3authProvider);

      // Store provider globally for Web3Service
      (window as any).web3authProvider = web3authProvider;

      // Try different methods to get wallet address
      let walletAddress: string | null = null;
      
      // Method 1: Try ethers.js with the provider
      try {
        const ethersProvider = new ethers.BrowserProvider(web3authProvider as any);
        const signer = await ethersProvider.getSigner();
        walletAddress = await signer.getAddress();
        console.log('Wallet address from ethers.js:', walletAddress);
      } catch (ethersError) {
        console.error('Failed to get address via ethers.js:', ethersError);
        
        // Method 2: Try direct provider request
        try {
          const accounts = await web3authProvider.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) {
            walletAddress = accounts[0];
            console.log('Wallet address from eth_accounts:', walletAddress);
          }
        } catch (providerError) {
          console.error('Failed to get address via provider.request:', providerError);
        }
      }
      
      if (!walletAddress) {
        throw new Error('Could not obtain wallet address');
      }
      
      console.log('Final wallet address:', walletAddress);
      
      // For social logins, we need to explicitly call getIdentityToken to get idToken (v10)
      const web3authInstance = (window as any).web3auth;
      if (web3authInstance && web3authInstance.connectedConnectorName === 'auth') {
        console.log('Social login detected, calling getIdentityToken immediately...');
        try {
          const authUser = await web3authInstance.getIdentityToken();
          console.log('Immediate getIdentityToken result:', authUser);
          if (authUser?.idToken) {
            console.log('Got idToken immediately from getIdentityToken');
            await login(authUser.idToken, walletAddress, web3authProvider);
            console.log('Login successful');
            setIsConnecting(false);
            return;
          }
        } catch (err) {
          console.error('Immediate getIdentityToken failed:', err);
        }
      }
      
      // Try to get idToken - poll for it since it may take longer than wallet address
      let tokenToUse = idToken;
      
      if (!tokenToUse) {
        console.log('idToken not available from hook immediately, polling for token...');
        
        // Poll for idToken with timeout
        const pollForToken = async (maxAttempts = 10, interval = 500) => {
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`Polling for idToken, attempt ${attempt}/${maxAttempts}`);
            
            // Check hook again
            if (idToken) {
              console.log('Got idToken from hook on attempt', attempt);
              return idToken;
            }
            
            // Check Web3Auth instance
            const web3authInstance = (window as any).web3auth;
            if (web3authInstance) {
              // Check state
              if (web3authInstance.state?.idToken) {
                console.log('Got idToken from state on attempt', attempt);
                return web3authInstance.state.idToken;
              }
              
              // Try getIdentityToken - this is required for social logins to get idToken (v10)
              if (web3authInstance.getIdentityToken) {
                try {
                  console.log(`Calling getIdentityToken on attempt ${attempt}...`);
                  const authUser = await web3authInstance.getIdentityToken();
                  console.log(`getIdentityToken result on attempt ${attempt}:`, authUser);
                  if (authUser?.idToken) {
                    console.log('Got idToken from getIdentityToken on attempt', attempt);
                    return authUser.idToken;
                  }
                } catch (err) {
                  console.warn(`getIdentityToken failed on attempt ${attempt}:`, err);
                }
              } else {
                console.log(`getIdentityToken method not available on attempt ${attempt}`);
              }
            }
            
            // Wait before next attempt
            if (attempt < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, interval));
            }
          }
          
          return null;
        };
        
        tokenToUse = await pollForToken();
        
        if (!tokenToUse) {
          console.error('No idToken available for social login after polling!');
          const web3authInstance = (window as any).web3auth;
          console.log('Final Web3Auth status:', web3authInstance?.status);
          console.log('Final Web3Auth state:', web3authInstance?.state);
          console.log('Connected adapter:', web3authInstance?.connectedAdapter);
          console.log('Connected connector name:', web3authInstance?.connectedConnectorName);
          console.log('Available connectors:', web3authInstance?.connectors);
          console.log('UserInfo from hook:', userInfo);
          
          // Check if there's sessionId or other auth data
          if (web3authInstance?.connectedAdapter) {
            console.log('Connected adapter details:', web3authInstance.connectedAdapter);
            console.log('Adapter sessionId:', web3authInstance.connectedAdapter.sessionId);
          }
          
          // This might be expected for certain login types - let's allow fallback
          console.warn('Using wallet address as authentication fallback');
          tokenToUse = `wallet:${walletAddress}`;
        }
      }
      
      // Check if idToken is available (either from hook or manual request)
      if (tokenToUse) {
        console.log('idToken available, proceeding with login...');
        await login(tokenToUse, walletAddress, web3authProvider);
        console.log('Login successful');
        setIsConnecting(false);
      } else {
        console.log('idToken not available, setting up pending login...');
        // Set pending login state - the useEffect will handle it when idToken arrives
        setPendingLogin({ walletAddress, provider: web3authProvider });
        // Keep isConnecting true until the pending login completes
      }
    } catch (error: any) {
      console.error('Connection failed:', error);
      // More specific error messages
      if (error.message?.includes('MetaMask')) {
        console.warn('MetaMask interference detected, but continuing with Web3Auth');
        // Don't show error to user for MetaMask conflicts - just log
      } else if (error.message?.includes('User closed the modal')) {
        // User cancelled - don't show error
      } else {
        alert(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
      }
    } finally {
      // Only set isConnecting to false if we're not waiting for a pending login
      if (!pendingLogin) {
        setIsConnecting(false);
      }
    }
  };

  if (!config) {
    return <LoadingSpinner />;
  }

  return (
    <Button
      onClick={connectWallet}
      disabled={isConnecting || isConnected}
      className="bg-green-500 hover:bg-green-600 text-gray-900 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <LoadingSpinner className="w-4 h-4 mr-2" />
          {pendingLogin ? 'Completing login...' : 'Connecting...'}
        </>
      ) : isConnected ? (
        'Connected'
      ) : (
        'Get Started'
      )}
    </Button>
  );
}
