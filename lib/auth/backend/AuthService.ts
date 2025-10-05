/**
 * Authentication service
 * High-level auth operations using BackendClient
 */

import { BackendClient } from './BackendClient';
import { BackendAuthResult, AuthUser } from '../types';

export class AuthService {
  private static instance: AuthService;
  private backendClient: BackendClient;

  private constructor() {
    this.backendClient = BackendClient.getInstance();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Complete authentication flow with backend
   */
  async authenticateWithBackend(token: string, walletAddress: string): Promise<BackendAuthResult> {
    console.log('🔧 AuthService: Starting backend authentication');

    try {
      const result = await this.backendClient.login(token, walletAddress);

      if (result.success) {
        console.log('🔧 AuthService: ✅ Backend authentication successful');
      } else {
        console.error('🔧 AuthService: ❌ Backend authentication failed:', result.error);
      }

      return result;
    } catch (error) {
      console.error('🔧 AuthService: ❌ Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Logout from backend
   */
  async logout(): Promise<void> {
    console.log('🔧 AuthService: Logging out');
    await this.backendClient.logout();
    console.log('🔧 AuthService: ✅ Logout completed');
  }

  /**
   * Check if user is authenticated with backend
   */
  async checkAuthentication(): Promise<BackendAuthResult> {
    return this.backendClient.checkAuthStatus();
  }

  /**
   * Get current user from backend
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const result = await this.backendClient.checkAuthStatus();
    return result.success ? result.user || null : null;
  }

  /**
   * Refresh user data from backend
   */
  async refreshUserData(): Promise<AuthUser | null> {
    return this.getCurrentUser();
  }

  /**
   * Make authenticated API call
   */
  async apiCall<T = any>(url: string, options: RequestInit = {}): Promise<{ data?: T; error?: string }> {
    return this.backendClient.apiCall<T>(url, options);
  }

  /**
   * Get current auth token
   */
  getCurrentToken(): string | null {
    return this.backendClient.getToken();
  }
}