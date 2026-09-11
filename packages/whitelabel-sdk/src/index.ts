/**
 * @conduit-ucpi/whitelabel-sdk
 *
 * White-label escrow surfaces. Configure a brand, wrap the app in
 * BrandProvider, and the product pages render in that brand.
 *
 * Consumed as TypeScript source through an npm workspace and Next's
 * transpilePackages, so there is no build step while it is dogfooded in this
 * repo. A bundled build goes in when it is published for outside consumers.
 */
export * from './config';
export * from './theme';
export * from './pages';
