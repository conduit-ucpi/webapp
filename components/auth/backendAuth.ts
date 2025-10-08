/**
 * Backend authentication handler
 * This class handles the actual backend verification of tokens and wallet addresses
 * It doesn't know or care whether the token came from Farcaster or Web3Auth
 *
 * Authentication strategy:
 * - Web browsers: Use http-only cookies (secure, automatic)
 * - Farcaster frames: May need to use Authorization header with token if cookies don't work
 */

import { mLog } from '../../utils/mobileLogger';

export interface BackendUser {
  userId: string;
  email?: string;
  walletAddress: string;
  userType?: string;
  // Any other fields the backend returns
}

export interface BackendAuthResult {
  success: boolean;
  user?: BackendUser;
  error?: string;
}

export class BackendAuth {
  private static instance: BackendAuth;
  private authToken: string | null = null; // Store token for all backend requests
  
  // Singleton pattern
  static getInstance(): BackendAuth {
    if (!BackendAuth.instance) {
      BackendAuth.instance = new BackendAuth();
    }
    return BackendAuth.instance;
  }
  
  /**
   * Get the current auth token
   */
  getToken(): string | null {
    return this.authToken;
  }

  /**
   * Force clear the auth token (useful for debugging)
   */
  clearToken(): void {
    console.log('🔧 BackendAuth: Clearing stored auth token');
    this.authToken = null;
  }

  /**
   * Force clear all auth state - both JWT token and cookies (useful for debugging)
   */
  clearAllAuthState(): void {
    console.log('🔧 BackendAuth: Clearing all auth state (token + cookies)');
    this.authToken = null;
    this.clearLocalCookies();
  }
  
  /**
   * Set the auth token (called after successful authentication)
   */
  setToken(token: string | null): void {
    this.authToken = token;
  }
  
  /**
   * Login with a token and wallet address
   * The token could be from Farcaster (JWT) or Web3Auth (idToken)
   * Stores the token for use in all subsequent backend requests
   *
   * @param token - Authentication token (JWT from Farcaster or idToken from Web3Auth)
   * @param walletAddress - User's wallet address
   * @returns Backend user data or error
   */
  async login(token: string, walletAddress: string): Promise<BackendAuthResult> {
    mLog.info('BackendAuth', 'Starting login process');
    mLog.debug('BackendAuth', 'Login request details', {
      tokenLength: token.length,
      walletAddress,
      tokenPreview: token.substring(0, 20) + '...'
    });

    try {
      // Store the token for future requests
      this.authToken = token;
      mLog.debug('BackendAuth', 'Token stored for future requests');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include', // Include cookies if they work
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          address: walletAddress
        })
      });

      mLog.debug('BackendAuth', 'Received login response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        // Clear token on failure
        this.authToken = null;
        const errorData = await response.json().catch(() => ({}));
        const errorResult = {
          success: false,
          error: errorData.error || `Login failed with status ${response.status}`
        };

        mLog.error('BackendAuth', 'Login failed', {
          status: response.status,
          error: errorResult.error,
          errorData
        });

        return errorResult;
      }

      const userData = await response.json();
      mLog.debug('BackendAuth', 'Login successful, received user data', {
        hasUserId: !!userData.userId,
        hasEmail: !!userData.email,
        hasWalletAddress: !!userData.walletAddress,
        userType: userData.userType
      });

      const result = {
        success: true,
        user: {
          userId: userData.userId,
          email: userData.email,
          walletAddress: userData.walletAddress || walletAddress,
          userType: userData.userType,
          ...userData // Include any other fields
        }
      };

      mLog.info('BackendAuth', 'Login completed successfully');
      return result;

    } catch (error) {
      // Clear token on error
      this.authToken = null;
      mLog.error('BackendAuth', 'Login error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backend login failed'
      };
    }
  }
  
  /**
   * Logout the current user
   * Clears backend session, stored auth token, and local cookies
   */
  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        await fetch('/api/auth/logout', { 
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
      }
      
      // Clear the stored token
      this.authToken = null;
      
      // Clear local cookies as backup (in case backend didn't clear them)
      this.clearLocalCookies();
      
    } catch (error) {
      console.error('Backend logout error:', error);
      // Even if logout fails, clear the token and cookies
      this.authToken = null;
      this.clearLocalCookies();
    }
  }

  /**
   * Clear local auth cookies as backup cleanup
   */
  private clearLocalCookies(): void {
    try {
      // Clear common auth cookie names
      const cookiesToClear = ['AUTH-TOKEN', 'auth-token', 'authToken', 'session'];
      
      cookiesToClear.forEach(cookieName => {
        // Clear for current domain
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure`;
        // Clear for current domain without path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=None; Secure`;
        // Clear for localhost (development)
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost; SameSite=None; Secure`;
      });
      
      console.log('🔧 BackendAuth: Local cookies cleared');
    } catch (error) {
      console.warn('🔧 BackendAuth: Failed to clear local cookies:', error);
    }
  }
  
  /**
   * Check current authentication status
   * Sends the auth token as Bearer token
   */
  async checkAuthStatus(): Promise<BackendAuthResult> {
    if (!this.authToken) {
      return {
        success: false,
        error: 'No auth token available'
      };
    }
    
    try {
      const response = await fetch('/api/auth/identity', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });
      
      if (!response.ok) {
        return {
          success: false,
          error: 'Not authenticated'
        };
      }
      
      const userData = await response.json();
      
      return {
        success: true,
        user: {
          userId: userData.userId,
          email: userData.email,
          walletAddress: userData.walletAddress,
          userType: userData.userType,
          ...userData
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'Failed to check auth status'
      };
    }
  }
  
  /**
   * Make an authenticated request to any backend API
   * Always sends the auth token as a Bearer token
   * 
   * @param url - The URL to fetch
   * @param options - Fetch options
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Always include auth token if available
    if (this.authToken) {
      console.log('🔧 BackendAuth: Sending auth token:', this.authToken.substring(0, 20) + '...');
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } else {
      console.log('🔧 BackendAuth: No auth token available, using cookies only');
    }
    
    const fetchOptions = {
      ...options,
      credentials: 'include' as RequestCredentials, // Include cookies as fallback
      headers
    };
    
    return fetch(url, fetchOptions);
  }
  
  /**
   * Helper to make authenticated API calls to backend services
   * Automatically handles JSON parsing and error responses
   */
  async apiCall<T = any>(url: string, options: RequestInit = {}): Promise<{ data?: T; error?: string }> {
    try {
      const response = await this.authenticatedFetch(url, options);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        return { error: error.error || `Request failed with status ${response.status}` };
      }
      
      const data = await response.json();
      return { data };
      
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'API call failed' 
      };
    }
  }
}