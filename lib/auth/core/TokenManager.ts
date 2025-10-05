/**
 * Token management (storage, validation, etc.)
 */

export class TokenManager {
  private static instance: TokenManager;
  private currentToken: string | null = null;

  constructor() {
    // Load token from storage on initialization
    this.loadFromStorage();
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
    return this.currentToken;
  }

  /**
   * Clear token
   */
  clearToken(): void {
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
      if (metadata?.type === 'social' || metadata?.issuer === 'web3auth') {
        localStorage.setItem('auth_token', token);
      } else {
        sessionStorage.setItem('auth_token', token);
      }
    } catch (error) {
      console.warn('🔧 TokenManager: Failed to save token to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      // Try localStorage first, then sessionStorage
      let token = localStorage.getItem('auth_token');
      if (!token) {
        token = sessionStorage.getItem('auth_token');
      }

      if (token && this.isValidToken(token)) {
        this.currentToken = token;
      }
    } catch (error) {
      console.warn('🔧 TokenManager: Failed to load token from storage:', error);
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    } catch (error) {
      console.warn('🔧 TokenManager: Failed to clear token storage:', error);
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