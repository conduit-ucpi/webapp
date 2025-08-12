import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" translate="no">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Store original ethereum provider for later restoration
              if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask) {
                console.log('MetaMask detected - storing reference for Web3Auth compatibility');
                window.__originalEthereum = window.ethereum;
                
                // Prevent MetaMask from auto-connecting during page load
                const originalRequest = window.ethereum.request;
                window.ethereum.request = function(args) {
                  if (args.method === 'eth_requestAccounts') {
                    console.log('Blocking MetaMask auto-connect during Web3Auth initialization');
                    return Promise.reject(new Error('MetaMask temporarily disabled for Web3Auth compatibility'));
                  }
                  return originalRequest.call(this, args);
                };
              }
            `,
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}