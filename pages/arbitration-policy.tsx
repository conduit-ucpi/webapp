import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * The policy page moved to /dispute-policy. On the box, next.config.js redirects before this page is
 * ever reached; the static export cannot redirect, so this page does it instead.
 *
 * The meta refresh is relative ('../dispute-policy/') so it keeps whatever basePath the export was
 * built with, and works without JavaScript. The router call is the faster path when JS runs.
 */
export default function ArbitrationPolicyMoved() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dispute-policy');
  }, [router]);

  return (
    <>
      <Head>
        <title>Dispute policy</title>
        <meta name="robots" content="noindex" />
        <meta httpEquiv="refresh" content="0; url=../dispute-policy/" />
      </Head>
      <p style={{ padding: '2rem' }}>
        This page has moved to the <Link href="/dispute-policy">dispute policy</Link>.
      </p>
    </>
  );
}
