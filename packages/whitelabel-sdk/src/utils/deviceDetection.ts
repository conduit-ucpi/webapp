/**
 * Device and wallet detection utilities for smart authentication routing
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasMetaMask: boolean;
  hasWallet: boolean;
  isWalletBrowser: boolean; // In-wallet browser like MetaMask Mobile, Trust Wallet browser
  walletType?: string; // 'metamask' | 'trust' | 'coinbase' | 'rabby' | etc
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
}

export interface AuthContext {
  isInIframe: boolean;
  isInFarcaster: boolean;
  hasExistingSession: boolean;
}

export type AuthMethod = 
  | 'farcaster'
  | 'metamask'
  | 'walletconnect'
  | 'external_wallet'
  | 'google'
  | 'facebook' 
  | 'email';

/**
 * Detect device type and capabilities
 */
export function detectDevice(): DeviceInfo {
  // Check if we're on server side
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      hasMetaMask: false,
      hasWallet: false,
      isWalletBrowser: false,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isFirefox: false,
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Detect OS
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
    (platform.startsWith('mac') && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(userAgent);
  
  // Detect browser
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isChrome = /chrome/.test(userAgent) && !/edg/.test(userAgent);
  const isFirefox = /firefox/.test(userAgent);
  
  // Detect device type
  const isMobile = /mobile|android|iphone|ipod/.test(userAgent) && !/ipad|tablet/.test(userAgent);
  const isTablet = /ipad|tablet|playbook/.test(userAgent) || 
    (isAndroid && !/mobile/.test(userAgent));
  const isDesktop = !isMobile && !isTablet;
  
  // Detect wallet browser (in-app browsers)
  const isWalletBrowser = detectWalletBrowser();
  
  // Detect installed wallets
  const { hasWallet, walletType, hasMetaMask } = detectWallets();
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    hasMetaMask,
    hasWallet,
    isWalletBrowser,
    walletType,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
  };
}

/**
 * Detect if we're in a wallet's in-app browser
 */
function detectWalletBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for wallet-specific properties
  const ethereum = (window as any).ethereum;
  if (!ethereum) return false;
  
  // Check if we're in a mobile wallet browser
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Common wallet browsers
  if (ethereum.isTrust) return true;
  if (ethereum.isTokenPocket) return true;
  if (ethereum.isCoinbaseWallet && /mobile/.test(userAgent)) return true;
  if (ethereum.isMetaMask && /mobile/.test(userAgent)) {
    // MetaMask mobile browser
    return true;
  }
  
  // Additional MetaMask mobile detection
  // MetaMask mobile sometimes doesn't set isMetaMask correctly in the in-app browser
  if (/mobile/.test(userAgent) && (
    userAgent.includes('metamask') ||
    ethereum._metamask ||
    ethereum.providerName === 'MetaMask'
  )) {
    return true;
  }
  
  // Check for other indicators
  if ((window as any).ReactNativeWebView) return true;
  
  return false;
}

/**
 * Detect available wallet providers
 */
function detectWallets(): { hasWallet: boolean; walletType?: string; hasMetaMask: boolean } {
  if (typeof window === 'undefined') {
    return { hasWallet: false, hasMetaMask: false };
  }
  
  const ethereum = (window as any).ethereum;
  
  if (!ethereum) {
    return { hasWallet: false, hasMetaMask: false };
  }
  
  // Handle multiple providers (e.g., MetaMask + other wallets)
  if (ethereum.providers?.length) {
    const metamaskProvider = ethereum.providers.find((p: any) => p.isMetaMask);
    if (metamaskProvider) {
      return { hasWallet: true, walletType: 'metamask', hasMetaMask: true };
    }
    
    // Check for other wallets in providers array
    for (const provider of ethereum.providers) {
      const walletType = identifyWalletType(provider);
      if (walletType) {
        return { hasWallet: true, walletType, hasMetaMask: false };
      }
    }
  }
  
  // Single provider
  const walletType = identifyWalletType(ethereum);
  const hasMetaMask = ethereum.isMetaMask === true;
  
  return {
    hasWallet: !!walletType,
    walletType,
    hasMetaMask,
  };
}

/**
 * Identify the type of wallet from provider object
 */
function identifyWalletType(provider: any): string | undefined {
  if (!provider) return undefined;
  
  // Check for MetaMask first with multiple indicators
  if (provider.isMetaMask || 
      provider._metamask || 
      provider.providerName === 'MetaMask' ||
      (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('metamask'))) {
    return 'metamask';
  }
  
  if (provider.isTrust) return 'trust';
  if (provider.isCoinbaseWallet) return 'coinbase';
  if (provider.isRabby) return 'rabby';
  if (provider.isBraveWallet) return 'brave';
  if (provider.isExodus) return 'exodus';
  if (provider.isFrame) return 'frame';
  if (provider.isTally) return 'tally';
  
  // Generic web3 wallet
  if (provider.request || provider.send) return 'generic';
  
  return undefined;
}

/**
 * Determine the best authentication method based on device and context
 */
export function getBestAuthMethod(deviceInfo: DeviceInfo, context: AuthContext): AuthMethod {
  // 1. Always use Farcaster auth if in Farcaster
  if (context.isInFarcaster) {
    return 'farcaster';
  }
  
  // 2. If we're in a wallet browser, prioritize MetaMask if detected
  if (deviceInfo.isWalletBrowser && deviceInfo.hasWallet) {
    if (deviceInfo.hasMetaMask || deviceInfo.walletType === 'metamask') {
      return 'metamask';
    }
    return 'external_wallet';
  }
  
  // 3. Desktop with MetaMask - prefer direct connection
  if (deviceInfo.isDesktop && deviceInfo.hasMetaMask) {
    return 'metamask';
  }
  
  // 4. Desktop with other wallet
  if (deviceInfo.isDesktop && deviceInfo.hasWallet) {
    return 'external_wallet';
  }
  
  // 5. Mobile device strategies
  if (deviceInfo.isMobile) {
    // If has MetaMask in mobile browser, prioritize it
    if (deviceInfo.hasMetaMask || deviceInfo.walletType === 'metamask') {
      return 'metamask';
    }
    // If has other wallet in mobile browser, use it
    if (deviceInfo.hasWallet) {
      return 'external_wallet';
    }
    
    // Otherwise use WalletConnect for mobile
    // This will trigger deep links to mobile wallets
    return 'walletconnect';
  }
  
  // 6. Tablet - similar to desktop
  if (deviceInfo.isTablet) {
    if (deviceInfo.hasWallet) {
      return 'external_wallet';
    }
    // Tablets can show QR codes well
    return 'walletconnect';
  }
  
  // 7. Default fallback - social login
  // This is best for users without crypto wallets
  return 'google';
}

/**
 * Get user-friendly description of recommended auth method
 */
export function getAuthMethodDescription(method: AuthMethod): string {
  switch (method) {
    case 'farcaster':
      return 'Continue with Farcaster';
    case 'metamask':
      return 'Connect MetaMask';
    case 'walletconnect':
      return 'Connect Wallet';
    case 'external_wallet':
      return 'Connect Wallet';
    case 'google':
      return 'Continue with Google';
    case 'facebook':
      return 'Continue with Facebook';
    case 'email':
      return 'Continue with Email';
    default:
      return 'Connect';
  }
}

/**
 * Check if the current context is in an iframe
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    return window.self !== window.top;
  } catch (e) {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true;
  }
}

/**
 * Get all viable auth methods for current context (for fallback options)
 */
export function getViableAuthMethods(deviceInfo: DeviceInfo, context: AuthContext): AuthMethod[] {
  const methods: AuthMethod[] = [];
  
  // Farcaster is exclusive
  if (context.isInFarcaster) {
    return ['farcaster'];
  }
  
  // Add wallet-based methods
  if (deviceInfo.hasMetaMask || deviceInfo.walletType === 'metamask') {
    methods.push('metamask');
  } else if (deviceInfo.hasWallet) {
    methods.push('external_wallet');
  }
  
  // WalletConnect is always an option (except in wallet browsers)
  if (!deviceInfo.isWalletBrowser) {
    methods.push('walletconnect');
  }
  
  // Social methods are always available
  methods.push('google', 'facebook', 'email');
  
  return methods;
}

/**
 * Determine if we should show a "Install Wallet" prompt
 */
export function shouldPromptWalletInstall(deviceInfo: DeviceInfo): boolean {
  // Don't prompt on mobile (they should use WalletConnect)
  if (deviceInfo.isMobile) return false;
  
  // Don't prompt if they already have a wallet
  if (deviceInfo.hasWallet) return false;
  
  // Don't prompt in wallet browsers
  if (deviceInfo.isWalletBrowser) return false;
  
  // Prompt on desktop without wallets
  return deviceInfo.isDesktop;
}