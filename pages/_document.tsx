import { Html, Head, Main, NextScript, DocumentContext } from 'next/document';
import Document from 'next/document';

interface DocumentProps {
  farcasterBaseUrl: string;
}

export default class CustomDocument extends Document<DocumentProps> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);

    // Auto-detect the base URL from the request (SSR), fallback to env for SSG
    const { req } = ctx;
    let farcasterBaseUrl = 'https://conduit-ucpi.com'; // Default fallback for static generation

    if (req && req.headers.host) {
      const protocol = req.headers['x-forwarded-proto'] || ((req.connection as any)?.encrypted ? 'https' : 'http');
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      farcasterBaseUrl = `${protocol}://${host}`;
    }

    return {
      ...initialProps,
      farcasterBaseUrl,
    };
  }

  render() {
    const { farcasterBaseUrl } = this.props;
  return (
    <Html lang="en" translate="no">
      <Head>
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5VFDF67M');`
        }} />
        {/* End Google Tag Manager */}

        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="google" content="notranslate" />

        {/* Favicons */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        {/* Farcaster mini-app configuration */}
        <meta name="fc:miniapp" content={`{"version": "next", "imageUrl": "${farcasterBaseUrl}/preview.png", "button": {"title": "🚩 Start", "action": {"type": "launch_frame", "name": "Instant Escrow", "url": "${farcasterBaseUrl}"}}}`} />
        {/* For backward compatibility */}
        <meta name="fc:frame" content={`{"version": "next", "imageUrl": "${farcasterBaseUrl}/preview.png", "button": {"title": "🚩 Start", "action": {"type": "launch_frame", "name": "Instant Escrow", "url": "${farcasterBaseUrl}"}}}`} />
        <meta property="og:image" content={`${farcasterBaseUrl}/preview.png`} />
        <meta property="og:title" content="Conduit Escrow" />
        <meta property="og:description" content="Time-delayed escrow contracts on blockchain" />
        
        {/* Farcaster domain verification */}
        <link rel="canonical" href="/.well-known/farcaster.json" />
        {/* MetaMask compatibility script removed - Web3Auth Modal handles MetaMask coexistence automatically */}
      </Head>
      <body>
        {/* Google Tag Manager (noscript) */}
        <noscript dangerouslySetInnerHTML={{
          __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5VFDF67M"
height="0" width="0" style="display:none;visibility:hidden"></iframe>`
        }} />
        {/* End Google Tag Manager (noscript) */}

        <Main />
        <NextScript />
      </body>
    </Html>
    );
  }
}
