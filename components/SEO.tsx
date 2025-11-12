import Head from 'next/head';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonical?: string;
  noindex?: boolean;
  structuredData?: object;
}

export default function SEO({
  title = 'Conduit Escrow - Secure Crypto Payments with Built-in Buyer Protection',
  description = 'Escrow protection made simple. Hold payments in trust until delivery is confirmed. No lawyers, no banks, just security. 1% fee, 60 second setup.',
  keywords = 'escrow, crypto escrow, blockchain escrow, USDC payments, secure payments, buyer protection, smart contract escrow, cryptocurrency escrow, Base network, time-delayed escrow, trustless payments',
  ogImage = '/preview.png',
  ogType = 'website',
  canonical,
  noindex = false,
  structuredData,
}: SEOProps) {
  const baseUrl = 'https://conduit-ucpi.com';
  const fullCanonical = canonical ? `${baseUrl}${canonical}` : baseUrl;

  return (
    <Head children={
      <>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Canonical URL */}
      <link rel="canonical" href={fullCanonical} />

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${baseUrl}${ogImage}`} />
      <meta property="og:site_name" content="Conduit Escrow" />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={fullCanonical} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={`${baseUrl}${ogImage}`} />

      {/* Additional SEO tags */}
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="author" content="Conduit UCPI" />

      {/* Structured Data */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      </>
    } />
  );
}
