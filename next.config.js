/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  // No basePath for Farcaster miniapp - needs to be at root domain
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH === 'null' ? undefined : (process.env.NEXT_PUBLIC_BASE_PATH || '/webapp'),
  
  // Rewrite .well-known/farcaster.json to dynamic API route
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: '/api/farcaster.json'
      }
    ]
  },

  // Redirects to external content
  async redirects() {
    return [
      {
        source: '/whats-wrong-with-payments',
        destination: 'https://medium.com/@charliepank/whats-wrong-with-payments-e2ea2bbeec87',
        permanent: true, // 301 permanent redirect
      }
    ]
  },

  // Headers configuration for iframe embedding and security
  async headers() {
    // Default frame ancestors for development and basic functionality
    const defaultFrameAncestors = "'self' https://warpcast.com https://*.farcaster.xyz https://farcaster.xyz";
    
    // Check environment variable for additional allowed domains
    // Can be set to:
    // - Specific domains: "https://merchant1.com https://merchant2.com"
    // - Wildcard patterns: "https://*.wordpress.com https://*.shopify.com"
    // - '*' to allow all domains (use with caution)
    const allowedFrameAncestors = process.env.ALLOWED_FRAME_ANCESTORS;
    
    let frameAncestorsValue;
    if (allowedFrameAncestors === '*') {
      // Allow all domains - removes frame-ancestors restriction entirely
      frameAncestorsValue = "*";
    } else if (allowedFrameAncestors) {
      // Combine default with additional allowed domains
      frameAncestorsValue = `${defaultFrameAncestors} ${allowedFrameAncestors}`;
    } else {
      // Use default frame ancestors
      frameAncestorsValue = defaultFrameAncestors;
    }

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          },
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestorsValue}`
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
