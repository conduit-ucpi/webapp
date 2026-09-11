/**
 * Route for the SDK's ContractPayPage.
 *
 * The page itself lives in packages/whitelabel-sdk/src/pages so a tenant can
 * mount the same flow in their own app. This file exists only to give it a
 * URL here — which makes our own site the first consumer of the SDK rather
 * than a separate implementation that can drift from it.
 */
export { ContractPayPage as default } from '@conduit-ucpi/whitelabel-sdk';
