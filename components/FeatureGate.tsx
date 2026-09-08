import type { ComponentType } from 'react';
import Head from 'next/head';
import { useConfig } from '@/components/auth/ConfigProvider';

/**
 * Client-side replacement for the `getServerSideProps` release gates that used to
 * live on these pages (see utils/featureFlags.ts). A static export has no server
 * to return `notFound`, so the check moves into the bundle.
 *
 * This is presentation only. Real enforcement stays where it already was — every
 * /api/projects/* and /api/email-verification/* handler calls its own
 * blockedBy*Flag() guard and answers 404 while the flag is off. Nothing here is
 * load-bearing for access control; it only stops a direct URL rendering an empty
 * shell against endpoints that are dark.
 */

/** Release flags carried on the /api/config response. */
export type ReleaseFlag = 'projectsLive' | 'emailVerificationLive';

function NotFound() {
  return (
    <>
      <Head>
        <title>Not found</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Not found</h1>
        <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>
          This page isn&apos;t available.
        </p>
      </div>
    </>
  );
}

/**
 * Wraps a page so it renders only while `flag` is true on /api/config.
 *
 * Renders nothing until the config has loaded — showing "not found" first and the
 * page a moment later would flash a 404 at every legitimate visitor.
 */
export function withFeatureGate<P extends object>(
  flag: ReleaseFlag,
  Page: ComponentType<P>
): ComponentType<P> {
  function GatedPage(props: P) {
    const { config } = useConfig();
    if (!config) return null;
    if (config[flag] !== true) return <NotFound />;
    return <Page {...props} />;
  }
  GatedPage.displayName = `withFeatureGate(${Page.displayName || Page.name || 'Page'})`;
  return GatedPage;
}
