import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import { SDKProvider } from '@/components/auth/SDKProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConfigProvider>
          <AuthProvider>
            <SDKProvider>
              <ToastProvider>
                <TourProvider>
                  <Layout>
                    <Component {...pageProps} />
                  </Layout>
                </TourProvider>
              </ToastProvider>
            </SDKProvider>
          </AuthProvider>
        </ConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}