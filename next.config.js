/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
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
  
  // Farcaster mini-app specific headers
  async headers() {
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
            value: "frame-ancestors 'self' https://warpcast.com https://*.farcaster.xyz https://farcaster.xyz"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
