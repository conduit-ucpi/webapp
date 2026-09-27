/**
 * The product surfaces.
 *
 * These are whole pages, not building blocks: a tenant mounts one at a route
 * and gets the full flow, themed from their brand config. They are exported
 * under stable names regardless of what the underlying component is called.
 */
export { default as CreatePage } from './CreatePage';
// The embed surface: what the WordPress/Shopify plugins and the one-line JS
// redirect point at. Layout renders it without chrome, so it drops cleanly into
// a tenant's own checkout.
export { default as ContractCreatePage } from './ContractCreatePage';
export { default as DashboardPage } from './DashboardPage';
export { default as ContractPayPage } from './ContractPayPage';
// Where Coinbase returns a buyer after paying by card, or a seller after cashing out. A tenant
// using either flow must mount these at /onramp-return and /offramp-return: the SDK's Coinbase
// code sends people back to exactly those paths.
export { default as OnrampReturnPage } from './OnrampReturnPage';
export { default as OfframpReturnPage } from './OfframpReturnPage';
