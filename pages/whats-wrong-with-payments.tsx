import Head from 'next/head';
import { useEffect } from 'react';

const ARTICLE_URL = 'https://medium.com/@charliepank/whats-wrong-with-payments-e2ea2bbeec87';

/**
 * The article lives on Medium. On the box, next.config.js redirects before this page is ever
 * reached; the static export cannot redirect, so this page does it instead (as arbitration-policy does).
 *
 * The meta refresh works without JavaScript; location.replace is the faster path when JS runs.
 */
export default function WhatsWrongWithPayments() {
  useEffect(() => {
    window.location.replace(ARTICLE_URL);
  }, []);

  return (
    <>
      <Head>
        <title>What&apos;s wrong with payments</title>
        <meta name="robots" content="noindex" />
        <meta httpEquiv="refresh" content={`0; url=${ARTICLE_URL}`} />
        <link rel="canonical" href={ARTICLE_URL} />
      </Head>
      <p style={{ padding: '2rem' }}>
        This article is on Medium: <a href={ARTICLE_URL}>What&apos;s wrong with payments</a>.
      </p>
    </>
  );
}
