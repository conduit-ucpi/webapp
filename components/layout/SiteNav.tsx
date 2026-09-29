import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useOptionalBrand, usePartnerBrand } from '@conduit-ucpi/whitelabel-sdk';
import { useAuth } from '@/components/auth';
import { useConfig } from '@/components/auth/ConfigProvider';
import { useNavigation } from '@/components/navigation/NavigationProvider';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { CLIENT_GIT_TAG, CLIENT_GIT_SHA, formatVersion } from '@/lib/buildVersion';
import { btnPrimary } from '@/utils/landingStyles';
import { getSiteNameFromDomain } from '@/utils/siteName';
import { accountLinks, siteNavGroups, SITE_NAV_PRICING, SiteNavLink } from './siteNavLinks';

const SSR_DEFAULT_SITE_NAME = 'Instant Escrow';

interface Props {
  /** Extra classes on the bar (sticky, translucent…): the page's call. */
  className?: string;
  /**
   * Draw the dark variant whatever the visitor's setting. For a page that is dark by design,
   * such as the homepage in the landing look, so the bar matches the page under it.
   */
  forceDark?: boolean;
}

const itemClass =
  'block px-3 py-2 rounded-lg text-sm text-secondary-900 dark:text-white hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors';
const panelClass =
  'absolute top-full mt-2 p-2 shadow-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 rounded-xl z-50';
const barItemClass =
  'inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-secondary-900 dark:text-white hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10">
      <path d={open ? 'M1 7l4-4 4 4' : 'M1 3l4 4 4-4'} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function NavItemLink({ item, onClick }: { item: SiteNavLink; onClick?: () => void }) {
  const inner = (
    <>
      <span className="block font-medium">{item.label}</span>
      {item.description && <span className="block text-xs mt-0.5 text-secondary-500 dark:text-secondary-400">{item.description}</span>}
    </>
  );
  // External sites open in a new tab; static /public pages need a full page load.
  if (item.external) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer" className={itemClass} onClick={onClick}>{inner}</a>;
  }
  if (item.isStatic) {
    return <a href={item.href} className={itemClass} onClick={onClick}>{inner}</a>;
  }
  return <Link href={item.href} className={itemClass} onClick={onClick}>{inner}</Link>;
}

/**
 * The site's top bar, on every page: the landing page's layout (grouped dropdowns, pricing, one
 * primary button), collapsing to a menu button below `md`, plus the account section the old app
 * drawer had — who is signed in, their account pages, dark mode, switch wallet, logout, and the
 * client and API versions.
 *
 * Styled only through theme classes, so it wears whichever look config/looks gives the app pages.
 */
export default function SiteNav({ className = '', forceDark = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const [siteName, setSiteName] = useState(SSR_DEFAULT_SITE_NAME);
  useEffect(() => setSiteName(getSiteNameFromDomain()), []);

  // The active brand names the site: a partner's, or the record our own domain maps to
  // (stabledrop.me, conduit-ucpi.com, instantescrow.nz… — see HOST_BRANDS in config/brands).
  // The hostname helper only covers the moment before a brand is resolved.
  //
  // Only a partner swaps our text wordmark for a logo; our own domains keep the wordmark.
  const brand = useOptionalBrand();
  const partnerBrand = usePartnerBrand();
  const displayName = brand?.name ?? siteName;
  const displaySubtitle = brand?.tagline ?? '';
  const partnerLogo = partnerBrand?.assets.logo;

  const { canGoBack, goBack } = useNavigation();
  const { user, disconnect, switchWallet, isConnected, state } = useAuth();
  const { config } = useConfig();
  const signedIn = !!isConnected;
  const isAdmin = !!(user as any)?.isAdmin;
  const canSwitchWallet = state?.providerName === 'web3auth';
  const wallet = user?.walletAddress;
  const userLabel = (user as any)?.username
    ? `@${(user as any).username}`
    : user?.email || (wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Signed in');
  const clientVersion = formatVersion(CLIENT_GIT_TAG, CLIENT_GIT_SHA);
  const apiVersion = formatVersion(config?.gitTag, config?.gitSha);

  // Pricing is a section of the homepage: an in-page anchor there, a link to it from elsewhere.
  const pricingHref = router.pathname === '/' ? SITE_NAV_PRICING.href.slice(1) : SITE_NAV_PRICING.href;
  const groups = siteNavGroups({ projectsLive: config?.projectsLive === true });
  const account = accountLinks({ emailVerificationLive: config?.emailVerificationLive === true, isAdmin });

  // Close on a click outside, Escape, or navigating somewhere.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  useEffect(() => {
    const done = () => { setOpen(null); setMobile(false); };
    router.events?.on('routeChangeStart', done);
    return () => router.events?.off('routeChangeStart', done);
  }, [router.events]);

  const closeAll = () => { setOpen(null); setMobile(false); };
  const handleLogout = async () => {
    closeAll();
    await disconnect();
    router.push('/');
  };
  const handleSwitchWallet = async () => {
    try {
      await switchWallet();
      closeAll();
    } catch (error) {
      console.error('Failed to switch wallet:', error);
    }
  };

  /** Who is signed in, their pages, and the controls — shared by the account menu and the mobile panel. */
  const accountSection = (
    <div className="space-y-3">
      <div className="px-3">
        <p className="text-sm font-medium text-secondary-900 dark:text-white truncate">{userLabel}</p>
        <p className="text-xs text-secondary-500 dark:text-secondary-400">Connected</p>
      </div>
      <div>
        {account.map((link) => (
          <Link key={link.href} href={link.href} className={itemClass} onClick={closeAll}>
            <span className="block font-medium">{link.label}</span>
          </Link>
        ))}
      </div>
      <div className="flex items-center justify-between px-3">
        <span className="text-sm text-secondary-600 dark:text-secondary-300">Dark mode</span>
        <ThemeToggle />
      </div>
      <div className="px-3 space-y-2">
        {canSwitchWallet && (
          <button type="button" onClick={handleSwitchWallet} className={`${itemClass} w-full text-left !px-0`}>
            Switch wallet
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors"
        >
          Logout
        </button>
      </div>
      <VersionBox clientVersion={clientVersion} apiVersion={apiVersion} />
    </div>
  );

  return (
    <div className={`${forceDark ? 'dark ' : ''}${className}`}>
      <nav
        className="w-full bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800 transition-colors"
        aria-label="Primary"
        ref={barRef}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6 min-w-0">
              <div className="flex items-center">
                {canGoBack && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="mr-3 p-2 rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                    aria-label="Go back"
                  >
                    <ArrowLeftIcon className="w-5 h-5 text-secondary-600 dark:text-secondary-300" />
                  </button>
                )}
                <Link href="/" className="flex flex-col">
                  {partnerLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={partnerLogo} alt={displayName} style={{ height: partnerBrand?.assets.logoHeight ?? '1.75rem' }} className="w-auto" />
                  ) : (
                    <span className="text-lg font-bold italic text-secondary-900 dark:text-white">{displayName}</span>
                  )}
                  <span className="text-xs text-primary-600 dark:text-primary-400 -mt-1">{displaySubtitle}</span>
                </Link>
              </div>

              <ul className="hidden md:flex items-center gap-1">
                {groups.map((group) => {
                  const isOpen = open === group.label;
                  return (
                    <li key={group.label} className="relative">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-haspopup="true"
                        onClick={() => setOpen(isOpen ? null : group.label)}
                        className={barItemClass}
                      >
                        {group.label}
                        <Chevron open={isOpen} />
                      </button>
                      {isOpen && (
                        <div role="menu" className={`${panelClass} left-0 w-80`}>
                          {group.items.map((item) => (
                            <NavItemLink key={item.href + item.label} item={item} onClick={() => setOpen(null)} />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
                <li>
                  <a href={pricingHref} className={barItemClass}>{SITE_NAV_PRICING.label}</a>
                </li>
              </ul>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {signedIn ? (
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={open === 'account'}
                    aria-haspopup="true"
                    aria-label="Account menu"
                    onClick={() => setOpen(open === 'account' ? null : 'account')}
                    className={`${barItemClass} max-w-[14rem]`}
                  >
                    <span className="truncate">{userLabel}</span>
                    <Chevron open={open === 'account'} />
                  </button>
                  {open === 'account' && (
                    <div role="menu" className={`${panelClass} right-0 w-72 py-3`}>
                      {accountSection}
                    </div>
                  )}
                </div>
              ) : (
                // "Dashboard", not "Sign in": the same door for new and returning visitors, and it signs them in.
                <Link href="/dashboard" className="px-3 py-2 text-sm text-secondary-900 dark:text-white hover:opacity-80">
                  Dashboard
                </Link>
              )}
              <Link href="/create" className={`${btnPrimary} !px-4 !py-2 !text-sm`}>
                Request payment
              </Link>
            </div>

            <button
              type="button"
              className="md:hidden p-2 rounded-lg text-secondary-700 dark:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-800"
              aria-label={mobile ? 'Close menu' : 'Open menu'}
              aria-expanded={mobile}
              onClick={() => setMobile((m) => !m)}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                {mobile ? (
                  <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="2" />
                ) : (
                  <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {mobile && (
          <div className="md:hidden border-t border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-6">
              {signedIn && (
                <div className="pb-4 border-b border-secondary-200 dark:border-secondary-800">{accountSection}</div>
              )}
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 text-xs uppercase tracking-wider mb-2 text-secondary-500 dark:text-secondary-400">{group.label}</p>
                  {group.items.map((item) => (
                    <NavItemLink key={item.href + item.label} item={item} onClick={closeAll} />
                  ))}
                </div>
              ))}
              <a href={pricingHref} className={itemClass} onClick={closeAll}>{SITE_NAV_PRICING.label}</a>
              <div className="flex gap-3 pt-2">
                {!signedIn && (
                  <Link href="/dashboard" className="flex-1 inline-flex items-center justify-center px-4 py-3 text-sm font-medium border border-secondary-300 dark:border-secondary-600 rounded-[var(--wl-button-radius)] text-secondary-900 dark:text-white" onClick={closeAll}>
                    Dashboard
                  </Link>
                )}
                <Link href="/create" className={`${btnPrimary} flex-1 !px-4`} onClick={closeAll}>
                  Request payment
                </Link>
              </div>
              {!signedIn && <VersionBox clientVersion={clientVersion} apiVersion={apiVersion} />}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

/**
 * The frontend and the API are separate deployments and can drift, so both are always shown,
 * even when they agree: the point is reading off which half is which.
 */
function VersionBox({ clientVersion, apiVersion }: { clientVersion: string; apiVersion: string }) {
  return (
    <div className="mx-3 px-2 py-1.5 bg-secondary-50 dark:bg-secondary-800 rounded text-xs text-secondary-500 dark:text-secondary-400" aria-label="Version">
      <div className="flex items-center justify-between">
        <span className="font-medium">Client</span>
        <span className="font-mono">{clientVersion || 'unknown'}</span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="font-medium">API</span>
        <span className="font-mono">{apiVersion || 'unknown'}</span>
      </div>
    </div>
  );
}
