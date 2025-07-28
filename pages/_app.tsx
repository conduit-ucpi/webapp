import type { AppProps } from 'next/app';
import { ConfigProvider } from '@/components/auth/ConfigProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ConfigProvider>
        <AuthProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </AuthProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}