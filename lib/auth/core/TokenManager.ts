/**
 * Token management (storage, validation, etc.)
 */

import { mLog } from '../../../utils/mobileLogger';

export class TokenManager {
  private static instance: TokenManager;
  private static hasLoadedFromStorage: boolean = false;
  private currentToken: string | null = null;

  constructor() {
    // Load token from storage on initialization (only once per session)
    if (!TokenManager.hasLoadedFromStorage) {
      this.loadFromStorage();
      TokenManager.hasLoadedFromStorage = true;
    }
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Store a token
   */
  setToken(token: string | null): void {
    mLog.debug('TokenManager', 'Setting token', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenType: token ? this.getTokenMetadata(token)?.type : null
    });
    this.currentToken = token;
    if (token) {
      this.saveToStorage(token);
    } else {
      this.clearStorage();
    }
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    mLog.debug('TokenManager', 'Getting token', {
      hasToken: !!this.currentToken,
      tokenLength: this.currentToken?.length
    });
    return this.currentToken;
  }

  /**
   * Clear token
   */
  clearToken(): void {
    mLog.info('TokenManager', 'Clearing token');
    this.currentToken = null;
    this.clearStorage();
  }

  /**
   * Check if token exists
   */
  hasToken(): boolean {
    return !!this.currentToken;
  }

  /**
   * Validate token format (basic validation)
   */
  isValidToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Basic length check
    if (token.length < 10) {
      return false;
    }

    // Check if it's a JWT-like format or base64 encoded
    if (token.includes('.') || this.isBase64(token)) {
      return true;
    }

    // Allow wallet signature format
    if (token.startsWith('wallet:') || token.startsWith('social:')) {
      return true;
    }

    return false;
  }

  /**
   * Extract token metadata (type, issuer, etc.)
   */
  getTokenMetadata(token?: string): any {
    const tokenToAnalyze = token || this.currentToken;
    if (!tokenToAnalyze) return null;

    try {
      // Try to decode as JWT
      if (tokenToAnalyze.includes('.')) {
        const parts = tokenToAnalyze.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          return {
            type: 'jwt',
            issuer: payload.iss,
            subject: payload.sub,
            expiry: payload.exp
          };
        }
      }

      // Try to decode as base64 JSON
      if (this.isBase64(tokenToAnalyze)) {
        const decoded = JSON.parse(atob(tokenToAnalyze));
        return {
          type: decoded.type || 'unknown',
          issuer: decoded.issuer,
          walletAddress: decoded.walletAddress
        };
      }

      // Handle simple formats
      if (tokenToAnalyze.startsWith('wallet:')) {
        return {
          type: 'wallet',
          walletAddress: tokenToAnalyze.substring(7)
        };
      }

      if (tokenToAnalyze.startsWith('social:')) {
        return {
          type: 'social',
          walletAddress: tokenToAnalyze.substring(7)
        };
      }

    } catch (error) {
      console.warn('🔧 TokenManager: Failed to parse token metadata:', error);
    }

    return { type: 'unknown' };
  }

  private saveToStorage(token: string): void {
    try {
      // Use sessionStorage for temporary tokens, localStorage for persistent ones
      const metadata = this.getTokenMetadata(token);
      const storageType = (metadata?.type === 'social' || metadata?.issuer === 'web3auth') ? 'localStorage' : 'sessionStorage';

      mLog.debug('TokenManager', 'Saving token to storage', {
        storageType,
        tokenType: metadata?.type,
        tokenLength: token.length
      });

      if (storageType === 'localStorage') {
        localStorage.setItem('auth_token', token);
      } else {
        sessionStorage.setItem('auth_token', token);
      }
    } catch (error) {
      mLog.error('TokenManager', 'Failed to save token to storage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private loadFromStorage(): void {
    try {
      // Try localStorage first, then sessionStorage
      let token = localStorage.getItem('auth_token');
      let storageSource = 'localStorage';

      if (!token) {
        token = sessionStorage.getItem('auth_token');
        storageSource = 'sessionStorage';
      }

      mLog.debug('TokenManager', 'Loading token from storage', {
        hasToken: !!token,
        storageSource,
        tokenLength: token?.length,
        isValid: token ? this.isValidToken(token) : false
      });

      if (token && this.isValidToken(token)) {
        this.currentToken = token;
        mLog.info('TokenManager', 'Token loaded from storage successfully');
      } else if (token) {
        mLog.warn('TokenManager', 'Invalid token found in storage, ignoring');
      }
    } catch (error) {
      mLog.error('TokenManager', 'Failed to load token from storage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private clearStorage(): void {
    try {
      mLog.debug('TokenManager', 'Clearing token from all storage');
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    } catch (error) {
      mLog.error('TokenManager', 'Failed to clear token storage', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }
}