/**
 * Unified backend API client
 * Handles all HTTP communication with backend services
 */

import { BackendAuthResult, AuthUser } from '../types';
import { TokenManager } from '../core/TokenManager';
import { AuthenticationExpiredError } from '../errors/AuthenticationExpiredError';

// Storage key for SIWX session cache (must match BackendSIWXStorage)
const SIWX_SESSION_STORAGE_KEY = 'conduit_siwx_session';

export class BackendClient {
  private static instance: BackendClient;
  private tokenManager: TokenManager;

  private constructor() {
    this.tokenManager = TokenManager.getInstance();
  }

  static getInstance(): BackendClient {
    if (!BackendClient.instance) {
      BackendClient.instance = new BackendClient();
    }
    return BackendClient.instance;
  }

  /**
   * Login with a token and wallet address
   */
  async login(token: string, walletAddress: string): Promise<BackendAuthResult> {
    try {
      console.log('🔧 BackendClient: Attempting login with token');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          address: walletAddress
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Login failed with status ${response.status}`
        };
      }

      const userData = await response.json();

      // Store token on successful login
      this.tokenManager.setToken(token);

      return {
        success: true,
        user: {
          userId: userData.userId,
          email: userData.email,
          walletAddress: userData.walletAddress || walletAddress,
          userType: userData.userType,
          ...userData
        }
      };

    } catch (error) {
      console.error('🔧 BackendClient: Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backend login failed'
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const token = this.tokenManager.getToken();

      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }

      // Clear token regardless of backend response
      this.tokenManager.clearToken();
      this.clearAuthCookies();

    } catch (error) {
      console.error('🔧 BackendClient: Logout error:', error);
      // Even if logout fails, clear local state
      this.tokenManager.clearToken();
      this.clearAuthCookies();
    }
  }

  /**
   * Check current authentication status
   * Works with both token-based auth (TokenManager) and cookie-based auth (SIWE)
   */
  async checkAuthStatus(): Promise<BackendAuthResult> {
    try {
      const token = this.tokenManager.getToken();

      // Build headers - include Authorization if we have a token
      // But still make the request even without a token, as SIWE uses HTTP-only cookies
      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/auth/identity', {
        credentials: 'include', // Important: includes cookies (AUTH-TOKEN for SIWE)
        headers
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
   *
   * Automatically detects 401 (expired JWT) and clears cached SIWX session.
   * Throws AuthenticationExpiredError so caller can trigger re-authentication.
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers: any = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.tokenManager.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
      ...options,
      credentials: 'include' as RequestCredentials,
      headers
    };

    const response = await fetch(url, fetchOptions);

    // Detect expired JWT (backend session expired)
    if (response.status === 401) {
      console.log('🔐 BackendClient: JWT expired (401) - wallet still connected, need fresh signature');

      // Clear cached SIWX session so it will request a new signature
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(SIWX_SESSION_STORAGE_KEY);
        console.log('🔐 BackendClient: Cleared cached SIWX session from sessionStorage');
      }

      // Throw specific error so caller can trigger re-authentication
      throw new AuthenticationExpiredError('Backend JWT expired - wallet still connected');
    }

    return response;
  }

  /**
   * Helper to make authenticated API calls with JSON parsing
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

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return this.tokenManager.getToken();
  }

  /**
   * Clear all auth state
   */
  clearAuthState(): void {
    this.tokenManager.clearToken();
    this.clearAuthCookies();
  }

  private clearAuthCookies(): void {
    try {
      const cookiesToClear = ['AUTH-TOKEN', 'auth-token', 'authToken', 'session'];

      cookiesToClear.forEach(cookieName => {
        // Clear for current domain
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=None; Secure`;
        // Clear for current domain without path
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=None; Secure`;
        // Clear for localhost (development)
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost; SameSite=None; Secure`;
      });

      console.log('🔧 BackendClient: Auth cookies cleared');
    } catch (error) {
      console.warn('🔧 BackendClient: Failed to clear auth cookies:', error);
    }
  }
}