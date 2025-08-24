import Head from 'next/head';
import { useEffect, useState } from 'react';

export function FarcasterMeta() {
  const [baseUrl, setBaseUrl] = useState('https://farcaster.conduit-ucpi.com');
  const [appName, setAppName] = useState('Conduit Escrow');

  useEffect(() => {
    // Determine environment based on current host
    const host = window.location.host;
    
    if (host.includes('dev.farcaster')) {
      setBaseUrl('https://dev.farcaster.conduit-ucpi.com');
      setAppName('Conduit Escrow (Dev)');
    } else if (host.includes('localhost') || host.includes('127.0.0.1')) {
      setBaseUrl(`${window.location.protocol}//${host}`);
      setAppName('Conduit Escrow (Local)');
    } else {
      setBaseUrl('https://farcaster.conduit-ucpi.com');
      setAppName('Conduit Escrow');
    }
  }, []);

  // Use Frame format exactly like the working farcaster app
  const frameContent = JSON.stringify({
    version: "next",
    imageUrl: `${baseUrl}/preview.png`,
    button: {
      title: "🚩 Start",
      action: {
        type: "launch_frame",
        name: appName.includes('Dev') ? "Instant Escrow (Dev)" : "Instant Escrow",
        url: baseUrl
      }
    }
  });

  return (
    <Head>
      <meta property="fc:miniapp" content={frameContent} />
      <meta property="og:image" content={`${baseUrl}/preview.png`} />
      <meta property="og:title" content={appName.includes('Dev') ? 'instant escrow (dev)' : 'instant escrow'} />
      <meta property="og:description" content="Use usdc smart-contracts to put funds in escrow on a time-delay." />
      <link rel="canonical" href="/.well-known/farcaster.json" />
    </Head>
  );
}