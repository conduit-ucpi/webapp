import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent MetaMask auto-connection interference
              if (typeof window !== 'undefined' && window.ethereum && window.ethereum.isMetaMask) {
                console.log('MetaMask detected - disabling auto-connection to prevent conflicts with Web3Auth');
                const originalEthereum = window.ethereum;
                window.ethereum = {
                  ...originalEthereum,
                  request: () => Promise.reject(new Error('MetaMask disabled for Web3Auth compatibility')),
                  enable: () => Promise.reject(new Error('MetaMask disabled for Web3Auth compatibility')),
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