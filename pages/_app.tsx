import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { UnifiedAuthProvider } from '@/components/auth/UnifiedAuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import { SDKProvider } from '@/components/auth/SDKProvider';
import FarcasterReady from '@/components/farcaster/FarcasterReady';
import { FarcasterDetectionProvider } from '@/components/farcaster/FarcasterDetectionProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FarcasterReady />
        <FarcasterDetectionProvider>
          <ConfigProvider>
            <SDKProvider>
              <UnifiedAuthProvider>
                <ToastProvider>
                  <TourProvider>
                    <Layout>
                      <Component {...pageProps} />
                    </Layout>
                  </TourProvider>
                </ToastProvider>
              </UnifiedAuthProvider>
            </SDKProvider>
          </ConfigProvider>
        </FarcasterDetectionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}