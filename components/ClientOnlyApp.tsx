import React from 'react';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { DynamicAuthWrapper } from '@/components/auth/DynamicAuthWrapper';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import FarcasterReady from '@/components/farcaster/FarcasterReady';
import { FarcasterDetectionProvider } from '@/components/farcaster/FarcasterDetectionProvider';
import { NavigationProvider } from '@/components/navigation/NavigationProvider';
import { EthersProvider } from '@/components/providers/EthersProvider';

interface ClientOnlyAppProps {
  Component: any;
  pageProps: any;
}

export default function ClientOnlyApp({ Component, pageProps }: ClientOnlyAppProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the provider structure to avoid hydration mismatches
  // The individual providers will handle their own loading states
  
  return (
    <ErrorBoundary children={
      <ThemeProvider children={
        <>
          <FarcasterReady />
          <FarcasterDetectionProvider children={
            <ConfigProvider children={
              <EthersProvider children={
                <DynamicAuthWrapper children={
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