import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';
import { Web3AuthInstanceProvider } from '@/components/auth/Web3AuthInstanceProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <Web3AuthInstanceProvider>
          <AuthProvider>
            <Layout>
              <Component {...pageProps} />
            </Layout>
          </AuthProvider>
        </Web3AuthInstanceProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}