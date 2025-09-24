import React from 'react';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import { SDKProvider } from '@/components/auth/SDKProvider';
import FarcasterReady from '@/components/farcaster/FarcasterReady';
import { FarcasterDetectionProvider } from '@/components/farcaster/FarcasterDetectionProvider';
import { NavigationProvider } from '@/components/navigation/NavigationProvider';

interface ClientOnlyAppProps {
  Component: any;
  pageProps: any;
}

export default function ClientOnlyApp({ Component, pageProps }: ClientOnlyAppProps) {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary children={
      <ThemeProvider children={
        <>
          <FarcasterReady />
          <FarcasterDetectionProvider children={
            <ConfigProvider children={
              <SDKProvider children={
                <AuthProvider children={
                  <NavigationProvider children={
                    <ToastProvider children={
                      <TourProvider children={
                        <Layout children={
                          <Component {...pageProps} />
                        } />
                      } />
                    } />
                  } />
                } />
              } />
            } />
          } />
        </>
      } />
    } />
  );
}