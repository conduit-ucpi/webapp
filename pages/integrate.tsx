import { Fragment, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import toast from 'react-hot-toast';
import SEO from '@/components/SEO';
import Fade from '@/components/ui/Fade';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { btnPrimary, btnOutline } from '@/utils/landingStyles';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { useConfig } from '@/components/auth/ConfigProvider';
import WalletRegistrationPrereq from '@/components/ui/WalletRegistrationPrereq';
import { API_BASE } from '@/lib/apiFetch';
import { API_DOCS_URL } from '@/lib/apiDocs';
import { useOptionalBrand, usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';
import { usePageT } from '@/config/locales';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fills `{name}` placeholders in a translated sentence with JSX — inline code, a link — so the
 * sentence stays one key and each language puts the elements where its own word order wants them.
 * Placeholders with no node given are left as written.
 */
function withNodes(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return name && name in nodes ? <Fragment key={i}>{nodes[name]}</Fragment> : part;
  });
}

function CodeBlock({ id, children, language = 'javascript' }: { id: string; children: string; language?: string }) {
  const t = usePageT();
  const copy = () => {
    navigator.clipboard.writeText(children);
    toast.success(t('integrate.copied'));
  };

  return (
    <div className="relative bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-md p-4 overflow-x-auto">
      <button
        onClick={copy}
        className={`${btnPrimary} absolute top-3 right-3 !py-1.5 !px-3 !text-xs`}
      >
        {t('integrate.copy')}
      </button>
      <code id={id} className="text-sm font-mono text-secondary-900 dark:text-secondary-100 whitespace-pre">
        {children}
      </code>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="text-[2.5rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-3">
      {String(n).padStart(2, '0')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegratePage() {
  const [exampleTab, setExampleTab] = useState('basic');
  const [modeTab, setModeTab] = useState('popup');
  const t = usePageT();

  const exampleTabs = [
    { id: 'basic', label: t('integrate.examples.tab.basic') },
    { id: 'extended', label: t('integrate.examples.tab.extended') },
    { id: 'custom', label: t('integrate.examples.tab.custom') },
    { id: 'usdt', label: t('integrate.examples.tab.usdt') },
  ];
  const modeTabs = [
    { id: 'popup', label: t('integrate.modes.tab.popup') },
    { id: 'redirect', label: t('integrate.modes.tab.redirect') },
  ];

  const { config } = useConfig();
  // Named from the brand's own record in the white-label service, as the other pages are; the
  // hostname only when there is no brand at all.
  const brand = useOptionalBrand();
  const siteName = brand?.name ?? getSiteNameFromDomain();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.instantescrow.nz';
  /*
   * ⚠️ THE API HOST, NOT THE APP HOST. `/api/results` on the app origin is the Next proxy, and
   *    that one calls requireAuth — a merchant's server has no session and gets 401. Caddy routes
   *    the API host straight to resultservice, which is public and is what these examples must
   *    show. Falls back to the deployed host for the box build, where API_BASE is empty.
   */
  const apiOrigin = API_BASE || 'https://api.stabledrop.me';
  /*
   * A white-label partner's merchants copy these samples from the partner's framed page, so the
   * partner's brand goes into them: the checkout then shows the partner's branding and records the
   * payment as made under them. Our own brands need no brand option.
   *
   * ⚠️ FROM THE BRAND'S RECORD, NOT THE ADDRESS BAR. usePartnerBrand only answers when `?b=` (or
   *    the route) names a brand the white-label service actually holds, and the id is that
   *    record's — so a mistyped `?b=` puts no brand in the samples rather than a wrong one.
   */
  const partnerBrand = usePartnerBrand();
  const partnerBrandId = partnerBrand?.id;
  // A partner's own support contact, from their record; ours otherwise.
  const support = partnerBrand?.links.support;
  const supportHref = support || 'mailto:info@stabledrop.me';
  const supportLabel = support ? support.replace(/^mailto:/, '') : 'info@stabledrop.me';
  const brandOption = partnerBrandId
    ? `\n\n    // Your partner brand: its branding on the checkout, and payments attributed to it\n    brand: '${partnerBrandId}',`
    : '';
  const brandOptionCompact = partnerBrandId ? `\n  brand: '${partnerBrandId}',` : '';
  const brandField = partnerBrandId ? `,\n    "brand": "${partnerBrandId}"` : '';

  const currencyList = config?.supportedTokens?.length
    ? config.supportedTokens.map(token => token.symbol).join('/')
    : config?.tokenSymbol || 'USDC';

  return (
    <>
      <SEO
        title={t('integrate.seo.title', { siteName })}
        description={t('integrate.seo.description')}
        keywords={t('integrate.seo.keywords')}
        canonical="/integrate"
      />
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300;6..72,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="bg-white dark:bg-secondary-900 transition-colors">

        {/* ================================================================ */}
        {/* HERO                                                             */}
        {/* ================================================================ */}
        <section className="flex items-center" aria-label={t('integrate.hero.ariaLabel')}>
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-24 lg:py-32 w-full">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.hero.eyebrow')}
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold text-secondary-900 dark:text-white leading-[1.1] tracking-tight max-w-3xl">
                {t('integrate.hero.title')}
              </h1>
              <p
                className="mt-6 text-base text-secondary-500 dark:text-secondary-400 max-w-xl leading-relaxed"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.hero.subtitle')}
              </p>
              <div className="mt-14 flex flex-wrap gap-x-8 gap-y-2 text-xs text-secondary-400 dark:text-secondary-500">
                <span>{t('integrate.hero.setup')}</span>
                <span>{t('integrate.hero.noBackend')}</span>
                <span>{t('integrate.hero.webhooks')}</span>
                <a href="/checkout-example.html" target="_blank" rel="noopener noreferrer" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors underline">{t('integrate.hero.liveDemo')}</a>
                <a href={API_DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors underline">{t('integrate.apiReference')}</a>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PREREQUISITES                                                    */}
        {/* ================================================================ */}
        <WalletRegistrationPrereq />

        {/* ================================================================ */}
        {/* QUICK START                                                      */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.quick.eyebrow')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.quick.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.quick.title')}
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-12 max-w-md">
                {t('integrate.quick.subtitle')}
              </p>
            </Fade>

            <div className="space-y-12">
              <Fade>
                <div>
                  <StepNumber n={1} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.quick.step1.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.quick.step1.body'), {
                      tag: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">&lt;/body&gt;</code>,
                    })}
                  </p>
                  <CodeBlock id="step1" language="html">
                    {`<script src="${origin}/conduit-checkout.js"></script>`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.1}>
                <div>
                  <StepNumber n={2} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.quick.step2.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.quick.step2.body')}
                  </p>
                  <CodeBlock id="step2">
                    {`<script>
  ConduitCheckout.init({
    // REQUIRED: Your wallet address to receive payments
    sellerAddress: '0xYourWalletAddressHere',

    // REQUIRED: Base URL of checkout page
    baseUrl: '${origin}',${brandOption}

    // RECOMMENDED: Auto-send verified payment to your backend
    webhookUrl: 'https://yoursite.com/api/conduit-webhook',
    webhookSecret: 'your-secret-key',  // Optional. Not the check that matters — see below.

    // Optional: Default token ('USDC' or 'USDT')
    tokenSymbol: 'USDC',

    // Optional: Days until auto-release (default: 7)
    expiryDays: 7,

    // Optional: Display mode ('popup' or 'redirect')
    mode: 'popup',

    // Success callback (webhook already sent!)
    onSuccess: function(data) {
      console.log('Payment verified!', data);
      alert('Thank you! Order #' + data.orderId + ' confirmed!');
    },

    // Error callback
    onError: function(error) {
      console.error('Payment failed:', error);
      alert('Payment failed: ' + error);
    },

    // Cancel callback
    onCancel: function() {
      console.log('Payment cancelled');
    }
  });
</script>`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.2}>
                <div>
                  <StepNumber n={3} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.quick.step3.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.quick.step3.body')}
                  </p>
                  <CodeBlock id="step3" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '50.00',
  description: 'Premium Product'
})">
  Pay $50 with USDC
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* DISPLAY MODES                                                    */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label={t('integrate.modes.eyebrow')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.modes.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.modes.title')}
              </h2>
            </Fade>

            <Tabs tabs={modeTabs} activeTab={modeTab} onTabChange={setModeTab} className="mb-8" />

            <TabPanel isActive={modeTab === 'popup'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.modes.popup.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.modes.popup.body')}
                  </p>
                  <CodeBlock id="mode-popup">{`mode: 'popup'`}</CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={modeTab === 'redirect'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.modes.redirect.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.modes.redirect.body')}
                  </p>
                  <CodeBlock id="mode-redirect">{`mode: 'redirect'`}</CodeBlock>
                </div>
              </Fade>
            </TabPanel>
          </div>
        </section>

        {/* ================================================================ */}
        {/* EXAMPLES                                                         */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.examples.eyebrow')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.examples.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.examples.title')}
              </h2>
            </Fade>

            <Tabs tabs={exampleTabs} activeTab={exampleTab} onTabChange={setExampleTab} className="mb-8" />

            <TabPanel isActive={exampleTab === 'basic'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.examples.basic.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.examples.basic.body')}
                  </p>
                  <CodeBlock id="ex-basic" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '29.99',
  description: 'Premium Widget - Blue',
  orderId: 'ORDER-12345'
})">
  Buy Now - $29.99
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'extended'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.examples.extended.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.examples.extended.body')}
                  </p>
                  <CodeBlock id="ex-extended" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '99.00',
  description: 'Professional Service Package',
  orderId: 'SERVICE-' + Date.now(),
  expiryDays: 30,  // 30-day buyer protection
  email: 'customer@example.com'
})">
  Purchase - $99
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'custom'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.examples.custom.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.examples.custom.body')}
                  </p>
                  <CodeBlock id="ex-custom" language="html">
                    {`<input type="number" id="amount" placeholder="Enter amount" min="1.001" step="0.01">
<button onclick="
  const amount = document.getElementById('amount').value;
  ConduitCheckout.open({
    amount: amount,
    description: 'Support our project',
    orderId: 'DONATION-' + Date.now()
  });
">
  Donate with USDC
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>

            <TabPanel isActive={exampleTab === 'usdt'}>
              <Fade>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.examples.usdt.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.examples.usdt.body')}
                  </p>
                  <CodeBlock id="ex-usdt" language="html">
                    {`<button onclick="ConduitCheckout.open({
  amount: '500.00',
  description: 'Enterprise License',
  tokenSymbol: 'USDT',  // Use USDT instead of USDC
  expiryDays: 14
})">
  Pay $500 with USDT
</button>`}
                  </CodeBlock>
                </div>
              </Fade>
            </TabPanel>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CONFIGURATION REFERENCE                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label={t('integrate.reference.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.reference.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.reference.title')}
              </h2>
            </Fade>

            {/* init() options */}
            <Fade>
              <div className="mb-12">
                <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
                  <code className="bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded text-base">ConduitCheckout.init(options)</code>
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                    <thead className="bg-secondary-100 dark:bg-secondary-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.option')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.type')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.required')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.default')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.description')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                      {[
                        { opt: 'sellerAddress', type: 'string', req: true, def: '-', desc: t('integrate.init.sellerAddress') },
                        { opt: 'baseUrl', type: 'string', req: true, def: '-', desc: t('integrate.init.baseUrl') },
                        { opt: 'brand', type: 'string', req: false, def: '-', desc: t('integrate.init.brand') },
                        { opt: 'webhookUrl', type: 'string', req: false, def: '-', desc: t('integrate.init.webhookUrl') },
                        { opt: 'webhookSecret', type: 'string', req: false, def: '-', desc: t('integrate.init.webhookSecret') },
                        { opt: 'tokenSymbol', type: 'string', req: false, def: "'USDC'", desc: t('integrate.init.tokenSymbol') },
                        { opt: 'expiryDays', type: 'number', req: false, def: '7', desc: t('integrate.init.expiryDays') },
                        { opt: 'mode', type: 'string', req: false, def: "'popup'", desc: t('integrate.init.mode') },
                        { opt: 'onSuccess', type: 'function', req: false, def: '-', desc: t('integrate.init.onSuccess') },
                        { opt: 'onError', type: 'function', req: false, def: '-', desc: t('integrate.init.onError') },
                        { opt: 'onCancel', type: 'function', req: false, def: '-', desc: t('integrate.init.onCancel') },
                      ].map((row, i) => (
                        <tr key={row.opt} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                          <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.opt}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.type}</td>
                          <td className={`px-4 py-3 font-medium ${row.req ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-500 dark:text-secondary-400'}`}>
                            {row.req ? t('integrate.yes') : t('integrate.no')}
                          </td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.def}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Fade>

            {/* open() params */}
            <Fade delay={0.1}>
              <div>
                <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-4">
                  <code className="bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded text-base">ConduitCheckout.open(params)</code>
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                    <thead className="bg-secondary-100 dark:bg-secondary-800">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.parameter')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.type')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.required')}</th>
                        <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.description')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                      {[
                        { param: 'amount', type: 'string/number', req: true, desc: t('integrate.open.amount') },
                        { param: 'description', type: 'string', req: true, desc: t('integrate.open.description') },
                        { param: 'orderId', type: 'string', req: false, desc: t('integrate.open.orderId') },
                        { param: 'email', type: 'string', req: false, desc: t('integrate.open.email') },
                        { param: 'tokenSymbol', type: 'string', req: false, desc: t('integrate.open.tokenSymbol') },
                        { param: 'expiryDays', type: 'number', req: false, desc: t('integrate.open.expiryDays') },
                        { param: 'webhookUrl', type: 'string', req: false, desc: t('integrate.open.webhookUrl') },
                        { param: 'metadata', type: 'object', req: false, desc: t('integrate.open.metadata') },
                      ].map((row, i) => (
                        <tr key={row.param} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                          <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.param}</td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.type}</td>
                          <td className={`px-4 py-3 font-medium ${row.req ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-500 dark:text-secondary-400'}`}>
                            {row.req ? t('integrate.yes') : t('integrate.no')}
                          </td>
                          <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* WEBHOOK INTEGRATION                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.server.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.server.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.server.title')}
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-12 max-w-xl">
                {withNodes(t('integrate.server.intro'), {
                  prepare: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">/api/ap2/prepare</code>,
                })}
              </p>
            </Fade>
            <div className="space-y-12">
              <Fade>
                <div>
                  <StepNumber n={1} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.server.step1.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {t('integrate.server.step1.body')}
                  </p>
                  <CodeBlock id="server-prepare" language="bash">
                    {`curl -X POST ${apiOrigin}/api/ap2/prepare \\
  -H 'Content-Type: application/json' \\
  -d '{
    "seller": "0xYourWalletAddress",
    "nominal_buyer": "customer@example.com",
    "amount": 50000000,
    "expiry_timestamp": 1893456000,
    "description": "Order #1042"${brandField}
  }'`}
                  </CodeBlock>
                </div>
              </Fade>
              <Fade delay={0.1}>
                <div>
                  <StepNumber n={2} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.server.step2.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.server.step2.body'), {
                      payLink: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">share_with_payer.pay_link</code>,
                      escrowAddress: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">escrow_address</code>,
                      fundByTransfer: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">fund_by_transfer</code>,
                    })}
                  </p>
                </div>
              </Fade>
              <Fade delay={0.2}>
                <div>
                  <StepNumber n={3} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.server.step3.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.server.step3.body'), {
                      settle: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">settle</code>,
                      settleRequest: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">POST /api/ap2/settle</code>,
                    })}
                  </p>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400">
                    {withNodes(t('integrate.server.step3.reference'), {
                      link: (
                        <a
                          href={API_DOCS_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {t('integrate.apiReference')}
                        </a>
                      ),
                    })}
                  </p>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.webhook.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.webhook.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-4"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.webhook.title')}
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-12 max-w-md">
                {withNodes(t('integrate.webhook.intro'), {
                  results: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">/api/results</code>,
                })}
              </p>
            </Fade>

            <div className="space-y-12">
              <Fade>
                <div>
                  <StepNumber n={1} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.webhook.step1.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.webhook.step1.body'), {
                      fetch: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">fetch()</code>,
                    })}
                  </p>
                  <CodeBlock id="webhook-init">
                    {`ConduitCheckout.init({
  sellerAddress: '0xYourWalletAddress',
  baseUrl: '${origin}',${brandOptionCompact}

  // Webhook config
  webhookUrl: 'https://yoursite.com/api/conduit-webhook',
  // Optional. It signs the POST, but this file is served to every visitor, so treat
  // the signature as a hint and let the /api/results lookup below decide.
  webhookSecret: 'your-secret-key',

  onSuccess: function(verifiedData) {
    // Webhook already sent! Just show UI confirmation
    console.log('Payment verified!', verifiedData);
    window.location.href = '/thank-you?order=' + verifiedData.orderId;
  },

  onError: function(error) {
    alert('Payment failed: ' + error);
  }
});`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.1}>
                <div>
                  <StepNumber n={2} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.webhook.step2.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.webhook.step2.body'), {
                      results: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">/api/results</code>,
                    })}
                  </p>
                  <CodeBlock id="webhook-handler">
                    {`// POST /api/conduit-webhook
app.post('/api/conduit-webhook', async (req, res) => {
  try {
    const { contractId, orderId } = req.body;

    // 1. ASK THE SOURCE OF TRUTH. Never fulfil on the request body alone —
    //    this is the only thing here that your own server has checked.
    const lookup = await fetch('${apiOrigin}/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractid: contractId })
    });
    const { count, results } = await lookup.json();

    if (count === 0) {
      return res.status(404).json({ error: 'No such payment' });
    }

    const payment = results[0];

    // 2. CHECK IT IS THE PAYMENT YOU WERE EXPECTING
    const order = await db.orders.findUnique({ where: { id: orderId } });

    // \`state\` is what says the money arrived. List the states that mean it did,
    // rather than ruling out the ones that mean it did not: a state you have not
    // heard of must not be read as payment. Waiting on one that turns out to be
    // fine costs another poll; clearing one that is not costs you the goods.
    //
    // ⚠️ chainAddress is NOT that signal. An escrow's address is worked out from
    // its terms and recorded when the buyer opens the payment page, before they
    // send anything — so it is present on unpaid orders too.
    const FUNDED_STATES = ['ACTIVE', 'DISPUTED', 'RESOLVED', 'CLAIMED', 'COMPLETED'];

    const paidToYou = payment.sellerWalletId.toLowerCase() === YOUR_WALLET.toLowerCase();
    const amount = payment.currency.toLowerCase().startsWith('micro')
      ? Number(payment.amount) / 1000000
      : Number(payment.amount);

    if (!paidToYou)                           return res.status(400).json({ error: 'Not your wallet' });
    if (!FUNDED_STATES.includes(payment.state)) return res.status(409).json({ error: 'Not funded yet' });
    if (Math.abs(amount - order.total) > 0.001) {
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // 3. NOW IT IS SAFE TO FULFIL
    await db.orders.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentContractId: contractId,
        paymentChainAddress: payment.chainAddress,
        paymentAmount: amount,
        paidAt: new Date()
      }
    });

    await fulfillment.ship(orderId);
    await email.sendConfirmation(order.email, orderId);

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});`}
                  </CodeBlock>
                </div>
              </Fade>

              <Fade delay={0.15}>
                <div>
                  <StepNumber n={3} />
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-2">{t('integrate.webhook.step3.title')}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.webhook.step3.body'), {
                      contractid: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded text-xs">contractid</code>,
                    })}
                  </p>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-4">
                    {withNodes(t('integrate.webhook.step3.openapi'), {
                      link: (
                        <a
                          href={`${apiOrigin}/resultservice/v3/api-docs`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-primary-600 dark:hover:text-primary-400 break-all"
                        >
                          {`${apiOrigin}/resultservice/v3/api-docs`}
                        </a>
                      ),
                    })}
                  </p>
                  <CodeBlock id="results-query-curl" language="bash">
                    {`curl -X POST ${apiOrigin}/api/results \\
  -H 'Content-Type: application/json' \\
  -d '{"contractid": "507f1f77bcf86cd799439011"}'`}
                  </CodeBlock>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-4 mb-3">
                    {t('integrate.webhook.step3.response')}
                  </p>
                  <CodeBlock id="results-query-response" language="json">
                    {`{
  "count": 1,
  "results": [
    {
      "contractid": "507f1f77bcf86cd799439011",
      "chainAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "sellerWalletId": "0xYourWalletAddress",
      "amount": 50000000.0,
      "description": "Order 1234",
      "currency": "microUSDC",
      "state": "CLAIMED",
      "chainId": "8453",
      "createdate": 1705318200,
      "maturity": 1705404600
    }
  ]
}`}
                  </CodeBlock>
                  {/* Query fields — the request side of /api/results. */}
                  <div className="overflow-x-auto mt-8">
                    <h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">{t('integrate.results.queryTitle')}</h4>
                    <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                      <thead className="bg-secondary-100 dark:bg-secondary-800">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.field')}</th>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.type')}</th>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.description')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                        {[
                          { f: 'contractid', t: 'string', d: t('integrate.results.query.contractid') },
                          { f: 'chainAddress', t: 'string', d: t('integrate.results.query.chainAddress') },
                          { f: 'chainAddresses', t: 'string[]', d: t('integrate.results.query.chainAddresses') },
                          { f: 'sellerWalletId', t: 'string', d: t('integrate.results.query.sellerWalletId') },
                        ].map((row, i) => (
                          <tr key={row.f} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                            <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.f}</td>
                            <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.t}</td>
                            <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-3">
                      {t('integrate.results.queryNote')}
                    </p>
                  </div>

                  {/* Response fields — every key ResultItem actually returns. */}
                  <div className="overflow-x-auto mt-8">
                    <h4 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">{t('integrate.results.responseTitle')}</h4>
                    <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                      <thead className="bg-secondary-100 dark:bg-secondary-800">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.field')}</th>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.type')}</th>
                          <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.description')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                        {[
                          { f: 'contractid', t: 'string', d: t('integrate.results.response.contractid') },
                          { f: 'chainAddress', t: 'string', d: t('integrate.results.response.chainAddress') },
                          { f: 'sellerWalletId', t: 'string', d: t('integrate.results.response.sellerWalletId') },
                          { f: 'amount', t: 'number', d: t('integrate.results.response.amount') },
                          { f: 'description', t: 'string', d: t('integrate.results.response.description') },
                          { f: 'currency', t: 'string', d: t('integrate.results.response.currency') },
                          { f: 'state', t: 'string', d: t('integrate.results.response.state') },
                          { f: 'chainId', t: 'string', d: t('integrate.results.response.chainId') },
                          { f: 'createdate', t: 'number', d: t('integrate.results.response.createdate') },
                          { f: 'maturity', t: 'number', d: t('integrate.results.response.maturity') },
                        ].map((row, i) => (
                          <tr key={row.f} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                            <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.f}</td>
                            <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.t}</td>
                            <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-secondary-500 dark:text-secondary-400 mt-4">
                    {withNodes(t('integrate.results.note'), {
                      countZero: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">count: 0</code>,
                      chainAddress: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">chainAddress</code>,
                      sellerWalletId: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">sellerWalletId</code>,
                      micro: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">micro</code>,
                      state: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">state</code>,
                      claimed: <code className="bg-secondary-100 dark:bg-secondary-800 px-1 rounded">CLAIMED</code>,
                    })}
                  </p>
                </div>
              </Fade>

              <Fade delay={0.2}>
                <div>
                  <h3 className="text-lg font-medium text-secondary-900 dark:text-white mb-3">{t('integrate.webhook.payloadTitle')}</h3>
                  <CodeBlock id="webhook-payload" language="json">
                    {`{
  "contractId": "507f1f77bcf86cd799439011",
  "chainAddress": "0x5678...",
  "seller": "0xYourWalletAddress",
  "amount": 50.00,
  "amountRaw": 50000000,
  "currencySymbol": "USDC",
  "currencyRaw": "microUSDC",
  "description": "Order 1234",
  "state": "OK",
  "verified": true,
  "verifiedAt": "2026-01-15T10:30:00.000Z",
  "orderId": "1234",
  "email": "buyer@example.com",
  "metadata": {},
  "timestamp": 1705318200
}`}
                  </CodeBlock>
                </div>
              </Fade>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* VERIFIED DATA REFERENCE                                          */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label={t('integrate.verified.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.verified.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.verified.title')}
              </h2>
            </Fade>

            <Fade delay={0.06}>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-secondary-200 dark:border-secondary-700 rounded-lg text-sm">
                  <thead className="bg-secondary-100 dark:bg-secondary-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.field')}</th>
                      <th className="px-4 py-3 text-left font-medium text-secondary-900 dark:text-white">{t('integrate.col.meaning')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
                    {[
                      { field: 'verified: true', meaning: t('integrate.verified.verified') },
                      { field: 'state: "ACTIVE"', meaning: t('integrate.verified.state') },
                      { field: 'seller: "0x..."', meaning: t('integrate.verified.seller') },
                      { field: 'amount: 50.0', meaning: t('integrate.verified.amount') },
                      { field: 'chainAddress', meaning: t('integrate.verified.chainAddress') },
                    ].map((row, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-secondary-50 dark:bg-secondary-800/50' : ''}>
                        <td className="px-4 py-3 font-mono text-secondary-900 dark:text-white">{row.field}</td>
                        <td className="px-4 py-3 text-secondary-500 dark:text-secondary-400">{row.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-secondary-500 dark:text-secondary-400">
                {t('integrate.verified.note')}
              </p>
            </Fade>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES & SECURITY                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.platform.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.platform.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-16"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.platform.title')}
              </h2>
            </Fade>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-10">
              {[
                {
                  label: t('integrate.platform.buyer.label'),
                  items: [
                    t('integrate.platform.buyer.1'),
                    t('integrate.platform.buyer.2'),
                    t('integrate.platform.buyer.3'),
                    t('integrate.platform.buyer.4'),
                  ],
                },
                {
                  label: t('integrate.platform.gas.label'),
                  items: [
                    t('integrate.platform.gas.1'),
                    t('integrate.platform.gas.2'),
                    t('integrate.platform.gas.3'),
                    t('integrate.platform.gas.4'),
                  ],
                },
                {
                  label: t('integrate.platform.security.label'),
                  items: [
                    t('integrate.platform.security.1'),
                    t('integrate.platform.security.2'),
                    t('integrate.platform.security.3'),
                    t('integrate.platform.security.4'),
                  ],
                },
                {
                  label: t('integrate.platform.tokens.label'),
                  items: [
                    t('integrate.platform.tokens.1'),
                    t('integrate.platform.tokens.2'),
                    t('integrate.platform.tokens.3'),
                    t('integrate.platform.tokens.4'),
                  ],
                },
              ].map((feat, i) => (
                <Fade key={i} delay={i * 0.06}>
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-3">
                      {feat.label}
                    </h3>
                    <ul className="space-y-1.5 text-sm text-secondary-500 dark:text-secondary-400">
                      {feat.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* CUSTOMER EXPERIENCE FLOW                                         */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-900"
          aria-label={t('integrate.flow.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-16">
                {t('integrate.flow.eyebrow')}
              </p>
            </Fade>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-x-12 gap-y-12">
              {[
                { num: '01', title: t('integrate.flow.1.title'), desc: t('integrate.flow.1.desc') },
                { num: '02', title: t('integrate.flow.2.title'), desc: t('integrate.flow.2.desc') },
                { num: '03', title: t('integrate.flow.3.title'), desc: t('integrate.flow.3.desc') },
                { num: '04', title: t('integrate.flow.4.title'), desc: t('integrate.flow.4.desc') },
                { num: '05', title: t('integrate.flow.5.title'), desc: t('integrate.flow.5.desc') },
              ].map((step, i) => (
                <Fade key={step.num} delay={i * 0.08}>
                  <div>
                    <span className="text-[3rem] leading-none font-extralight text-secondary-100 dark:text-secondary-800 select-none block mb-3">
                      {step.num}
                    </span>
                    <h3 className="text-sm font-medium text-secondary-900 dark:text-white mb-1">
                      {step.title}
                    </h3>
                    <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FAQ                                                              */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.faq.eyebrow')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
            <Fade>
              <p className="text-xs tracking-[0.2em] uppercase text-secondary-400 dark:text-secondary-500 mb-6">
                {t('integrate.faq.eyebrow')}
              </p>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug max-w-2xl mb-10"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.faq.title')}
              </h2>
            </Fade>

            <div className="space-y-4">
              {[
                {
                  q: t('integrate.faq.tokens.q'),
                  a: t('integrate.faq.tokens.a', { currencies: currencyList }),
                },
                {
                  q: t('integrate.faq.fees.q'),
                  a: t('integrate.faq.fees.a'),
                },
                {
                  q: t('integrate.faq.payout.q'),
                  a: t('integrate.faq.payout.a'),
                },
                {
                  q: t('integrate.faq.refunds.q'),
                  a: t('integrate.faq.refunds.a'),
                },
                {
                  q: t('integrate.faq.wallet.q'),
                  a: t('integrate.faq.wallet.a'),
                },
                {
                  q: t('integrate.faq.secure.q'),
                  a: t('integrate.faq.secure.a'),
                },
                {
                  q: t('integrate.faq.chargebacks.q'),
                  a: t('integrate.faq.chargebacks.a'),
                },
              ].map((item, i) => (
                <Fade key={i} delay={i * 0.04}>
                  <details className="border border-secondary-200 dark:border-secondary-700 rounded-lg group">
                    <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-secondary-900 dark:text-white hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors rounded-lg">
                      {item.q}
                    </summary>
                    <div className="px-6 pb-4 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">
                      {item.a}
                    </div>
                  </details>
                </Fade>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA                                                        */}
        {/* ================================================================ */}
        <section
          className="border-t border-secondary-100 dark:border-secondary-800"
          aria-label={t('integrate.cta.ariaLabel')}
        >
          <div className="max-w-5xl mx-auto px-6 sm:px-8 pt-24 lg:pt-28 pb-16 lg:pb-20">
            <Fade>
              <h2
                className="text-3xl sm:text-4xl font-light text-secondary-900 dark:text-white leading-snug mb-3"
                style={{ fontFamily: 'var(--wl-font-accent)' }}
              >
                {t('integrate.cta.title')}
              </h2>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-8 max-w-md">
                {t('integrate.cta.body')}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/checkout-example.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnPrimary}
                >
                  {t('integrate.cta.demo')}
                </a>
                <Link href="/merchant" className={btnOutline}>
                  {t('integrate.cta.merchant')}
                </Link>
              </div>
            </Fade>

            {/* Footer links */}
            <Fade delay={0.2}>
              <div className="mt-14 pt-8 border-t border-secondary-100 dark:border-secondary-800 flex flex-wrap gap-x-8 gap-y-3 text-xs text-secondary-400 dark:text-secondary-500">
                <Link href="/how-it-works" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {t('integrate.footer.howItWorks')}
                </Link>
                <Link href="/faq" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {t('integrate.footer.faq')}
                </Link>
                <Link href="/shopify/install-button" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {t('integrate.footer.shopify')}
                </Link>
                <a
                  href={API_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  {t('integrate.apiReference')}
                </a>
                <Link href="/white-label" className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors">
                  {t('integrate.footer.whiteLabel')}
                </Link>
                <a
                  href="https://github.com/conduit-ucpi/contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  {t('integrate.footer.source')}
                </a>
                <a
                  href={supportHref}
                  className="hover:text-secondary-600 dark:hover:text-secondary-300 transition-colors"
                >
                  {supportLabel}
                </a>
              </div>
            </Fade>
          </div>
        </section>

      </div>
    </>
  );
}
