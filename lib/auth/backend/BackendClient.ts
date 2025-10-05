/**
 * Unified backend API client
 * Handles all HTTP communication with backend services
 */

import { BackendAuthResult, AuthUser } from '../types';
import { TokenManager } from '../core/TokenManager';

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
   */
  async checkAuthStatus(): Promise<BackendAuthResult> {
    const token = this.tokenManager.getToken();

    if (!token) {
      return {
        success: false,
        error: 'No auth token available'
      };
    }

    try {
      const response = await fetch('/api/auth/identity', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
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

    return fetch(url, fetchOptions);
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