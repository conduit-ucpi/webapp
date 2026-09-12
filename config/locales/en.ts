/**
 * Copy owned by this deployment's own pages, in the source language.
 *
 * Distinct from the SDK catalogue, which covers the product surfaces the SDK
 * ships (the wizard, the dashboard, the payer pages). Anything in here is copy
 * a different tenant would write differently, so it stays on our side of the
 * line rather than being inherited by everyone who installs the SDK.
 *
 * Keys are namespaced by page. Add a namespace when you add a page; the Spanish
 * file is typed against this one, so a key added here without a translation is
 * a compile error rather than a string that quietly renders in English.
 *
 * `{brand}` and friends are filled by interpolate() at call time — never
 * concatenate around a translated string, because word order is not the same in
 * every language.
 */

export const pagesEn = {
  // /create-cobro — the white-labelled create page. Generic wording: the brand
  // name is interpolated, so this same copy serves any pinned partner route.
  'wl.badge': 'Escrow-backed · settled in USDC on Base',
  'wl.dashboard': 'Dashboard',

  'wl.loadingTitle': 'Create a payment request',
  'wl.loadingSubtitle': 'Setting things up…',

  'wl.connectTitle': 'Get started with {brand}',
  'wl.connectSubtitle':
    'We use a wallet to securely send and receive your payments. Sign in with Google or an email address and one is created for you.',

  'wl.createTitle': 'Time-locked payment request',
  'wl.createSubtitle':
    'Set an amount and a release date. The buyer pays into escrow, disputes stay open until that date, and the funds then move to you automatically.',

  'wl.howTitle': 'How this works',
  'wl.howStep1': 'You set the amount, stablecoin, and release terms',
  'wl.howStep2': 'The buyer pays into escrow – funds are held but not sent to you yet',
  'wl.howStep3':
    'Funds release to your wallet automatically on the release terms you set',

  'wl.assuranceFee': '1% flat fee',
  'wl.assuranceChargebacks': 'No chargebacks',
  'wl.assuranceGas': 'Gas paid for you',
  'wl.assuranceCustody': 'Non-custodial',

  'wl.footerTerms': 'Terms',
  'wl.footerPrivacy': 'Privacy',
  'wl.footerDisputes': 'Disputes',

  'wl.seoTitle': '{brand} — create a payment request',
  'wl.seoDescription':
    'Set an amount and a payout date. The buyer pays into escrow, and the funds release automatically on the date you both agreed.',
} as const;

export type PagesMessageKey = keyof typeof pagesEn;
