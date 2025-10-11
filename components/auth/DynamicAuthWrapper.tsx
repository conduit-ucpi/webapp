/**
 * Wrapper that combines Dynamic provider with our auth system
 * Has access to config to determine whether to use Dynamic
 */

import React from 'react';
import { useConfig } from '@/components/auth/ConfigProvider';
import { DynamicWrapper } from '@/components/auth/DynamicWrapper';
import { SimpleAuthProvider as AuthProvider } from '@/components/auth/SimpleAuthProvider';

interface DynamicAuthWrapperProps {
  children: React.ReactNode;
}

export function DynamicAuthWrapper({ children }: DynamicAuthWrapperProps) {
  const { config, isLoading } = useConfig();

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <DynamicWrapper config={config} children={
      <AuthProvider>
        {children}
      </AuthProvider>
    } />
  );
}