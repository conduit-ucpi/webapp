/**
 * The Content-Security-Policy, for both places the app is served from:
 *
 *   - Cloudflare Pages (stabledrop.me): the static export. next.config.js headers() do not exist
 *     there, so it reads public/_headers, which is written from this file by
 *     scripts/write-csp-headers.js. A test fails if the two differ.
 *   - The box: next.config.js headers().
 *
 * ⚠️ REPORT-ONLY. Browsers report what this would block and block nothing. To enforce it, rename the
 *    header in CSP_HEADER and regenerate; first check the `CSP VIOLATION` lines in Grafana.
 *
 * Starts from Privy's list: https://docs.privy.io/security/implementation-guide/content-security-policy
 * Re-test after upgrading Privy or Reown, since either can start calling a new host.
 */
const crypto = require('crypto');

const CSP_HEADER = 'Content-Security-Policy-Report-Only';

/**
 * Applies the saved theme before React hydrates, to prevent a flash. It lives here because the policy
 * allows it by hash, and a static site cannot use nonces: any change to this text changes the hash.
 */
const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||((!t)&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();";

const inlineScriptHash = (source) =>
  `'sha256-${crypto.createHash('sha256').update(source).digest('base64')}'`;

const PRIVY_FRAMES = ['https://auth.privy.io'];
const WALLETCONNECT_FRAMES = ['https://verify.walletconnect.com', 'https://verify.walletconnect.org'];

/**
 * Who may frame the static site: Farcaster clients, the Shopify admin for /shopify/embedded, and the
 * merchants that embed us. A new embedding merchant goes here.
 */
const FRAME_ANCESTORS = [
  "'self'",
  'https://warpcast.com',
  'https://*.farcaster.xyz',
  'https://farcaster.xyz',
  'https://admin.shopify.com',
  'https://*.myshopify.com',
  'https://escrow-me.com',
  'https://www.escrow-me.com',
  'https://pay.co.ve',
  'https://payment.co.ve',
  'https://payments.co.ve',
  'https://payment.com.ve',
  'https://payments.com.ve',
  'https://cobro.co.ve',
  'https://cobro.com.ve',
];

const DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    inlineScriptHash(THEME_INIT_SCRIPT),
    'https://challenges.cloudflare.com', // Privy's Turnstile
    'https://www.googletagmanager.com', // Analytics, after consent
    'https://www.redditstatic.com', // Pixel on /plugins
    'https://cdn.shopify.com', // App Bridge on /shopify/embedded
    'https://www.youtube.com', // iframe API for video tracking
  ],
  // Inline styles: Privy's and Reown's modals, and style attributes throughout.
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.reown.com'],
  // Any https image: wallet icons, token logos and QR codes come from hosts we do not control, and an
  // image cannot run anything.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'child-src': [...PRIVY_FRAMES, ...WALLETCONNECT_FRAMES],
  'frame-src': [
    ...PRIVY_FRAMES,
    ...WALLETCONNECT_FRAMES,
    'https://challenges.cloudflare.com', // Privy's Turnstile
    'https://secure.walletconnect.org', // Reown social login
    'https://www.youtube-nocookie.com', // Landing video
    'https://www.youtube.com',
  ],
  'connect-src': [
    "'self'",
    'https://api.stabledrop.me',
    // Privy
    'https://auth.privy.io',
    'https://*.rpc.privy.systems',
    'https://api.relay.link', // Funding kit's bridge
    // WalletConnect / Reown
    'wss://relay.walletconnect.com',
    'wss://relay.walletconnect.org',
    'https://explorer-api.walletconnect.com',
    'https://api.web3modal.org',
    'https://pulse.walletconnect.org',
    'https://rpc.walletconnect.org',
    // Coinbase: wallet connection, and exchange rates
    'wss://www.walletlink.org',
    'https://api.coinbase.com',
    // Chain RPC, from RPC_URL in each environment
    'https://mainnet.base.org',
    'https://sepolia.base.org',
    'https://rpc.ankr.com',
    // Analytics, after consent
    'https://www.googletagmanager.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://stats.g.doubleclick.net',
    // Pixel on /plugins
    'https://*.reddit.com',
  ],
};

function buildCsp({ reportUri, frameAncestors }) {
  const directives = { ...DIRECTIVES };
  if (frameAncestors) directives['frame-ancestors'] = frameAncestors;
  directives['report-uri'] = [reportUri];
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/** The box serves its own API, and sets frame-ancestors itself from ALLOWED_FRAME_ANCESTORS. */
const boxCsp = () => buildCsp({ reportUri: '/api/telemetry/csp-report' });

/** The contents of public/_headers. */
const cloudflareHeadersFile = () =>
  [
    '# Generated from config/csp.js by scripts/write-csp-headers.js. Do not edit.',
    '/*',
    `  ${CSP_HEADER}: ${buildCsp({
      reportUri: 'https://api.stabledrop.me/api/telemetry/csp-report',
      frameAncestors: FRAME_ANCESTORS,
    })}`,
    '',
  ].join('\n');

module.exports = { CSP_HEADER, THEME_INIT_SCRIPT, boxCsp, cloudflareHeadersFile };
