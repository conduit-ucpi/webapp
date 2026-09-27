import type { PartialBrandTheme } from '@conduit-ucpi/whitelabel-sdk';
import type { LandingTheme } from '@/components/landing-test/theme';

/**
 * One complete look, in both of the formats the site renders from.
 *
 * The landing page styles itself from `--lt-*` CSS variables (LandingTheme); every other page
 * styles itself from the SDK brand theme's `--wl-*` colour ranges (PartialBrandTheme). A look
 * carries both, so either part of the site can wear any look: see ./index.ts.
 */
export interface Look {
  name: string;
  /** The look in the landing page's format. */
  landing: LandingTheme;
  /** The look in the SDK brand format the app pages use. Omitted fields fall back to the SDK defaults. */
  app: PartialBrandTheme;
  /**
   * A stylesheet for fonts this look needs that the site does not already load. Inter is loaded
   * site-wide by styles/globals.css, so a look set in Inter needs none.
   */
  fontsHref?: string;
}
