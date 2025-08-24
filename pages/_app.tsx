import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';
import { Web3AuthProviderWrapper } from '@/components/auth/Web3AuthProviderWrapper';
import { Web3AuthContextProvider } from '@/components/auth/Web3AuthContextProvider';
import { AuthContextProvider } from '@/lib/auth/AuthContextProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TourProvider } from '@/components/onboarding/TourProvider';
import { WalletProvider } from '@/lib/wallet/WalletProvider';
import { SDKProvider } from '@/components/auth/SDKProvider';
import FarcasterReady from '@/components/farcaster/FarcasterReady';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConfigProvider>
          <SDKProvider>
            <Web3AuthProviderWrapper>
              <Web3AuthContextProvider>
                <AuthContextProvider>
                  <WalletProvider>
                    <AuthProvider>
                    <ToastProvider>
                      <TourProvider>
                        <FarcasterReady />
                        <Layout>
                          <Component {...pageProps} />
                        </Layout>
                      </TourProvider>
                    </ToastProvider>
                    </AuthProvider>
                  </WalletProvider>
                </AuthContextProvider>
              </Web3AuthContextProvider>
            </Web3AuthProviderWrapper>
          </SDKProvider>
        </ConfigProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}