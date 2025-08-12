import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';
import { Web3AuthProviderWrapper } from '@/components/auth/Web3AuthProviderWrapper';
import { Web3AuthContextProvider } from '@/components/auth/Web3AuthContextProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <Web3AuthProviderWrapper>
          <Web3AuthContextProvider>
            <AuthProvider>
              <Layout>
                <Component {...pageProps} />
              </Layout>
            </AuthProvider>
          </Web3AuthContextProvider>
        </Web3AuthProviderWrapper>
      </ConfigProvider>
    </ErrorBoundary>
  );
}