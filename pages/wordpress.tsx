import Head from 'next/head';
import { useEffect } from 'react';

const DESTINATION =
  'https://wordpress.org/plugins/usdc-payments-with-buyer-protection/';

/**
 * Was a `getServerSideProps` 301. A static export has no server to issue one, so
 * the redirect happens in the document instead: a meta refresh for crawlers and
 * no-JS clients, and location.replace() for everyone else (replace, not assign,
 * so Back does not bounce the visitor straight back here).
 *
 * Note this is weaker than the 301 it replaces — search engines treat a meta
 * refresh as a soft redirect and /wordpress is listed in the sitemap at priority
 * 0.8. If that ranking matters, the redirect belongs at the CDN instead.
 */
export default function WordPressRedirect() {
  useEffect(() => {
    window.location.replace(DESTINATION);
  }, []);

  return (
    <Head>
      <meta httpEquiv="refresh" content={`0; url=${DESTINATION}`} />
      <link rel="canonical" href={DESTINATION} />
      <meta name="robots" content="noindex, follow" />
    </Head>
  );
}
