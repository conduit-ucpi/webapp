/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH === 'null' ? undefined : (process.env.NEXT_PUBLIC_BASE_PATH || '/webapp'),
  // Remove assetPrefix - let Next.js handle assets with basePath
}

module.exports = nextConfig