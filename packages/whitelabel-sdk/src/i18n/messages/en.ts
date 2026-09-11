/**
 * The source catalogue. English is the key set every other locale must satisfy.
 *
 * Keys are dotted and namespaced by surface so a string can be found from the
 * screen it appears on. `{placeholders}` are interpolated by `t()`.
 */
export const en = {
  'create.title': 'Time-locked payment request',
  'create.subtitle': 'Set up a secure time-delayed escrow with automatic dispute resolution',
  'create.getStarted': 'Get Started with {brand}',
  'create.walletBlurb': 'We use a wallet to securely send and receive your payments.',
  'create.howThisWorks': 'How this works',
  'create.step.amount': 'You set the amount, stablecoin, and release terms',
  'create.step.escrow': 'The buyer pays into escrow – funds are held but not sent to you yet',
  'create.step.release': 'Funds release to your wallet automatically on the release terms you set',
  'steps.connect.title': 'Connect',
  'steps.connect.detail': 'Securely connect your wallet or continue with email',
  'steps.terms.title': 'Payment Terms',
  'steps.terms.detail': 'Enter the payment details',
  'steps.complete.title': 'Complete & Send',
  'steps.complete.detail': "Choose how you'd like to send your payment request",
  'steps.addFunds.title': 'Add Funds',
  'steps.addFunds.detail': 'Add USDC to your wallet',
  'steps.confirmSend.title': 'Confirm & Send',
  'steps.confirmSend.detail': 'Confirm the payment, it will be held securely in escrow',
  'steps.completePayment.title': 'Complete Payment',
  'steps.completePayment.detail':
    'Funds in escrow release to the seller once your payment is confirmed',
  'wallet.signInTitle': 'Sign in to set up your wallet',
  'wallet.signInBlurb':
    "We'll create a secure wallet that only you control, or reconnect the one you already have. Nothing to install.",
  'wallet.continueSocial': 'Continue with email or social login',
  'wallet.advanced': 'Advanced wallet connection',
} as const;

export type MessageKey = keyof typeof en;
export type Catalogue = Record<MessageKey, string>;
