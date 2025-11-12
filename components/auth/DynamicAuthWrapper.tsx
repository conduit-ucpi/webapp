/**
 * Wrapper that combines Dynamic provider with our auth system
 * Has access to config to determine whether to use Dynamic
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useConfig } from '@/components/auth/ConfigProvider';
import { DynamicWrapper } from '@/components/auth/DynamicWrapper';
import { SimpleAuthProvider as AuthProvider } from '@/components/auth/SimpleAuthProvider';

interface DynamicAuthWrapperProps {
  children: React.ReactNode;
}

// Public pages that should render without waiting for config (for SEO)
const PUBLIC_PAGES = ['/', '/faq', '/arbitration-policy', '/integrate', '/plugins'];

export function DynamicAuthWrapper({ children }: DynamicAuthWrapperProps) {
  const { config, isLoading } = useConfig();
  const router = useRouter();

  // Allow public pages to render immediately for SEO (no loading spinner)
  const isPublicPage = PUBLIC_PAGES.includes(router.pathname);

  if (isPublicPage && (isLoading || !config)) {
    // Render public pages immediately without auth wrapper during SSG
    return <>{children}</>;
  }

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