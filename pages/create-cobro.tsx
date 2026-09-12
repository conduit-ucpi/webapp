import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/components/auth';
import CreateContractWizard from '@/components/contracts/CreateContractWizard';
import CreateProgressSteps from '@/components/contracts/CreateProgressSteps';
import WalletChoiceCards from '@/components/auth/WalletChoiceCards';
import Skeleton from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import { useBrand } from '@conduit-ucpi/whitelabel-sdk';

// ---------------------------------------------------------------------------
// /create-cobro — white-labelled payment-request page
// ---------------------------------------------------------------------------
//
// Functionally identical to /create by construction: same CreateContractWizard,
// same WalletChoiceCards, same CreateProgressSteps, same auth branching, same
// autoConnect query handling. None of those is forked or modified, so escrow
// behaviour cannot drift between the two pages — only the chrome differs.
//
// This route is in WHITE_LABEL_ROUTES (config/brands), which does two things:
// Layout renders no header or footer, and BrandProvider pins the brand to
// COBRO regardless of `?b=`. So useBrand() here is COBRO's resolved config,
// the same object /create?b=cobro gets, and the CSS variables driving the
// wizard below are already COBRO's. To rebrand this page, change the entry in
// WHITE_LABEL_ROUTES — there is nothing brand-specific left in this file.
//
// The wizard keeps its own light styling on a white panel, the way the
// reference alternates dark and light bands. Nothing inside it is restyled
// from out here — that would mean reaching into a shared component.

/**
 * Theme colours as CSS colour strings.
 *
 * The theme stores RGB triples ("0 200 150") so Tailwind can keep `/50` alpha
 * modifiers working through a custom property. Out here we are writing inline
 * styles rather than classes, so the triple has to be wrapped — and the same
 * form takes an alpha, which is what the old `${accent}1a` hex suffixes were
 * doing less legibly.
 *
 * These bands stay inline rather than becoming bg-secondary-900: in dark mode
 * the page background is already secondary-900, and the banner would stop
 * reading as a band against it.
 */
const rgb = (triple: string, alpha?: number) =>
  alpha === undefined ? `rgb(${triple})` : `rgb(${triple} / ${alpha})`;

const HOW_IT_WORKS = [
  'You set the amount, stablecoin, and release terms',
  'The buyer pays into escrow – funds are held but not sent to you yet',
  'Funds release to your wallet automatically on the release terms you set',
];

export default function CreateWhiteLabelPage() {
  const { isLoading, isConnected, address } = useAuth();
  const router = useRouter();
  const autoConnect = router.query.autoConnect === 'true';
  const brand = useBrand();

  const accent = rgb(brand.theme.primary[500]);
  const ink = rgb(brand.theme.secondary[900]);

  const banner = (title: string, sub: string) => (
    <section className="relative overflow-hidden" style={{ backgroundColor: ink }}>
      <div
        aria-hidden="true"
        className="absolute -top-32 right-0 h-[28rem] w-[28rem] rounded-full blur-[130px]"
        style={{ backgroundColor: rgb(brand.theme.primary[500], 0.1) }}
      />

      {/* The brand's own header, since ours is suppressed on this route. */}
      <div className="relative max-w-5xl mx-auto px-6 sm:px-10 pt-6 flex items-center justify-between gap-4">
        <div>
          {/* A supplied logo file wins; otherwise the name is set as a wordmark.
              eslint-disable-next-line @next/next/no-img-element — the asset is a
              partner-supplied file of unknown dimensions, not something to run
              through the image optimiser. */}
          {brand.assets.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.assets.logo} alt={brand.name} className="h-7 w-auto" />
          ) : (
            <p className="text-lg font-extrabold tracking-tight text-white leading-none">{brand.name}</p>
          )}
          {brand.tagline && (
            <p className="text-[11px] mt-1" style={{ color: accent }}>{brand.tagline}</p>
          )}
        </div>
        <Link href="/dashboard" className="text-sm text-white/50 hover:text-white transition-colors">
          Dashboard
        </Link>
      </div>

      <div className="relative max-w-4xl mx-auto px-6 sm:px-10 py-10 sm:py-14 text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
          style={{ backgroundColor: rgb(brand.theme.primary[500], 0.12), color: accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          Escrow-backed · settled in USDC on Base
        </span>
        <h1 className="mt-6 text-[2.1rem] sm:text-5xl font-extrabold text-white leading-[1.05] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mt-4 text-base sm:text-lg text-white/55 leading-relaxed max-w-xl mx-auto">{sub}</p>
      </div>
    </section>
  );

  const footer = (
    <footer className="mt-4" style={{ backgroundColor: ink }}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-xs text-white/30">{brand.copy.operatorNote}</p>
        <span className="ml-auto flex gap-5 text-xs text-white/40">
          <Link href="/terms-of-service" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/arbitration-policy" className="hover:text-white transition-colors">Disputes</Link>
        </span>
      </div>
    </footer>
  );

  const shell = (children: React.ReactNode) => (
    <>
      <SEO
        title={`${brand.name} — create a payment request`}
        description="Set an amount and a payout date. The buyer pays into escrow, and the funds release automatically on the date you both agreed."
        canonical="/create-cobro"
        noindex
      />
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div
        style={{ fontFamily: brand.theme.fontFamily }}
        className="bg-secondary-50 dark:bg-secondary-900 min-h-screen flex flex-col"
      >
        <div className="flex-1">{children}</div>
        {footer}
      </div>
    </>
  );

  if (isLoading) {
    return shell(
      <>
        {banner('Create a payment request', 'Setting things up…')}
        <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
          <div className="rounded-2xl bg-white dark:bg-secondary-800 border border-secondary-900/[0.06] dark:border-white/10 p-8">
            <div className="space-y-6">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // Same condition as /create: a connected wallet gates the wizard. Backend auth
  // (SIWE) is not required — lazy auth fires on the first API call.
  if (!isConnected || !address) {
    return shell(
      <>
        {banner(
          `Get started with ${brand.name}`,
          'We use a wallet to securely send and receive your payments. Sign in with Google or an email address and one is created for you.'
        )}

        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10 sm:py-12">
          <CreateProgressSteps current={0} />

          <WalletChoiceCards autoConnect={autoConnect} />

          <div className="mt-8 rounded-2xl p-7 sm:p-8" style={{ backgroundColor: ink }}>
            <h2 className="text-xl font-extrabold tracking-tight text-white mb-6">How this works</h2>
            <ol className="space-y-5">
              {HOW_IT_WORKS.map((text, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    className="shrink-0 w-8 h-8 rounded-xl grid place-items-center text-xs font-bold"
                    style={{ backgroundColor: rgb(brand.theme.primary[500], 0.14), color: accent }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-white/60 leading-relaxed pt-1.5">{text}</p>
                </li>
              ))}
            </ol>

            <div className="mt-7 pt-6 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/40">
              {['1% flat fee', 'No chargebacks', 'Gas paid for you', 'Non-custodial'].map((t) => (
                <span key={t} className="inline-flex items-center gap-2">
                  <span style={{ color: accent }} aria-hidden="true">&#10003;</span>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return shell(
    <>
      {banner(
        'Time-locked payment request',
        'Set an amount and a release date. The buyer pays into escrow, disputes stay open until that date, and the funds then move to you automatically.'
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="flex justify-center">
          <CreateContractWizard />
        </div>
      </div>
    </>
  );
}
