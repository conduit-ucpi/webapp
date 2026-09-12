import React from 'react';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { SimpleAuthProvider } from '@/components/auth/SimpleAuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import FarcasterReady from '@/components/farcaster/FarcasterReady';
import { FarcasterDetectionProvider } from '@/components/farcaster/FarcasterDetectionProvider';
import { NavigationProvider } from '@/components/navigation/NavigationProvider';
import { EthersProvider } from '@/components/providers/EthersProvider';
import { captureConsoleForMobile } from '@/utils/mobileLogger';
import { BrandProvider, BrandI18nProvider } from '@conduit-ucpi/whitelabel-sdk';
import { BRANDS, DEFAULT_BRAND_ID, WHITE_LABEL_ROUTES } from '@/config/brands';
import { useRouter } from 'next/router';

interface ClientOnlyAppProps {
  Component: any;
  pageProps: any;
}

export default function ClientOnlyApp({ Component, pageProps }: ClientOnlyAppProps) {
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  // A white-label route is that partner's page whatever the query says. The
  // resolution still happens after hydration, so this cannot desync the
  // server-rendered markup.
  const routeBrandId = WHITE_LABEL_ROUTES[router.pathname] ?? null;

  React.useEffect(() => {
    /* Mirror console output into the mobile log pipeline before anything else
       runs, so a dependency's own console.error (notably AppKit's SIWX
       failures) is visible from a phone. No-op off mobile. */
    captureConsoleForMobile();
    setMounted(true);
  }, []);

  // Always render the provider structure to avoid hydration mismatches
  // The individual providers will handle their own loading states
  
  return (
    <ErrorBoundary children={
      <BrandProvider brands={BRANDS} defaultBrandId={DEFAULT_BRAND_ID} routeBrandId={routeBrandId} children={
      <BrandI18nProvider children={
      <ThemeProvider children={
        <>
          <FarcasterReady />
          <FarcasterDetectionProvider children={
            <ConfigProvider children={
              <EthersProvider children={
                <SimpleAuthProvider children={
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
      } />
    } />
  );
}