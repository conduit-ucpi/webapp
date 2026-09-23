/**
 * Route for the SDK's ContractCreatePage.
 *
 * The payer-facing embed surface. Layout still special-cases this pathname to
 * render without our header and footer, which is what lets a tenant drop it
 * into their own checkout — so the route path matters and must not change.
 *
 * The page itself lives in packages/whitelabel-sdk/src/pages.
 */
export { ContractCreatePage as default } from '@conduit-ucpi/whitelabel-sdk';
