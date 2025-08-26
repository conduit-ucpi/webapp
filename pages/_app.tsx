import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import ClientOnlyApp from '@/components/ClientOnlyApp';

export default function App({ Component, pageProps }: AppProps) {
  return <ClientOnlyApp Component={Component} pageProps={pageProps} />;
}