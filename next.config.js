/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  // No basePath for Farcaster miniapp - needs to be at root domain
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH === 'null' ? undefined : (process.env.NEXT_PUBLIC_BASE_PATH || '/webapp'),
  
  // Farcaster hosted manifest redirect
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/0198e282-0f23-ff23-aa6e-09f3301522bc',
        permanent: false,
        statusCode: 307
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