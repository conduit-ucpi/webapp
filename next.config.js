/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH === undefined ? '/webapp' : process.env.NEXT_PUBLIC_BASE_PATH,
  // Remove assetPrefix - let Next.js handle assets with basePath
}

module.exports = nextConfig