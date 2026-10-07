import { NAV_GROUPS, NAV_PRICING, NavGroup, NavLink } from '@/components/landing-test/content';

/**
 * Every link the site navigation shows, in one place.
 *
 * The groups are the landing page's (components/landing-test/content.ts), so the homepage and
 * the app pages cannot drift. Two additions from the old app drawer: the extra resources it
 * listed, and the account links that only make sense signed in.
 */

export interface SiteNavLink extends NavLink {
  /** A page served from /public: a full page load, not client-side routing. */
  isStatic?: boolean;
}

export interface SiteNavGroup {
  label: string;
  items: SiteNavLink[];
}

/** Resources the old app drawer carried that the landing list did not. */
const EXTRA_RESOURCES: SiteNavLink[] = [
  { label: 'How a payment works', href: '/stabledrop-payment-flow.html', isStatic: true },
  { label: 'How liquid funding works', href: '/stabledrop-liquid-flow.html', isStatic: true },
  { label: 'Savings calculator', href: '/merchant-savings-calculator' },
  { label: 'Buy tokens', href: '/buy-token' },
  { label: "What's wrong with payments", href: '/whats-wrong-with-payments' },
];

export interface SiteNavOptions {
  /** Projects is behind a release flag (config.projectsLive). */
  projectsLive: boolean;
}

export function siteNavGroups({ projectsLive }: SiteNavOptions): SiteNavGroup[] {
  return NAV_GROUPS.map((group: NavGroup) => {
    let items: SiteNavLink[] = group.items;
    if (group.label === 'Products' && !projectsLive) items = items.filter((i) => i.href !== '/projects');
    if (group.label === 'Resources') items = [...items, ...EXTRA_RESOURCES];
    return { label: group.label, items };
  });
}

/** Pricing lives on the homepage; from any other page it is an anchor there. */
export const SITE_NAV_PRICING: SiteNavLink = { ...NAV_PRICING, href: `/${NAV_PRICING.href}` };

export interface AccountLink {
  label: string;
  href: string;
  /** Only for admins (user.isAdmin). */
  admin?: boolean;
}

export function accountLinks({ emailVerificationLive, isAdmin }: { emailVerificationLive: boolean; isAdmin: boolean }): AccountLink[] {
  return [
    { label: 'Dashboard', href: '/dashboard' },
    // Disputes the user has been named tiebreaker on. Everyone gets the link: whether they hold
    // any seat is only known once the page asks contractservice.
    { label: 'Disputes', href: '/disputes' },
    { label: 'Wallet', href: '/wallet' },
    { label: 'Get paid early', href: '/offers' },
    ...(emailVerificationLive ? [{ label: 'Verify email', href: '/email-verification' }] : []),
    ...(isAdmin ? [{ label: 'Admin panel', href: '/admin', admin: true }] : []),
  ];
}
