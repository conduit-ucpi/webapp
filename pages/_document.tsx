import { Html, Head, Main, NextScript, DocumentContext } from 'next/document';
import Document from 'next/document';

interface DocumentProps {
  farcasterBaseUrl: string;
}

export default class CustomDocument extends Document<DocumentProps> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    
    // Auto-detect the base URL from the request
    const { req } = ctx;
    let farcasterBaseUrl = 'https://farcaster.conduit-ucpi.com'; // fallback
    
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || (req.connection as any)?.encrypted ? 'https' : 'http';
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
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta httpEquiv="Content-Language" content="en" />
        <meta name="google" content="notranslate" />
        
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
        <Main />
        <NextScript />
      </body>
    </Html>
    );
  }
}
