/**
 * Backend authentication hook
 */

import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { AuthService } from '../../backend/AuthService';

export function useBackendAuth() {
  const { user } = useAuth();
  const authService = AuthService.getInstance();

  const getCurrentUser = useCallback(async () => {
    return await authService.getCurrentUser();
  }, [authService]);

  const refreshUserData = useCallback(async () => {
    return await authService.refreshUserData();
  }, [authService]);

  const checkAuthStatus = useCallback(async () => {
    return await authService.checkAuthentication();
  }, [authService]);

  const apiCall = useCallback(async <T = any>(url: string, options: RequestInit = {}) => {
    return await authService.apiCall<T>(url, options);
  }, [authService]);

  const getToken = useCallback(() => {
    return authService.getCurrentToken();
  }, [authService]);

  return {
    // State
    user,
    isAuthenticated: !!user,

    // Operations
    getCurrentUser,
    refreshUserData,
    checkAuthStatus,
    apiCall,
    getToken
  };
}