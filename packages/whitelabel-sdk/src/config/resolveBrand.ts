import { BrandAssets, BrandConfig, ResolvedBrand, BrandTheme, PartialBrandTheme, PaletteName } from './types';
import { DEFAULT_THEME } from './defaults';
import { brandAssetUrl } from './remoteBrand';

/**
 * Fill a partial tenant config out to something the components can read without
 * optional-chaining every access.
 *
 * Merging is deep for the theme and shallow elsewhere, which matches how these
 * are actually authored: a tenant supplies an accent ramp and inherits the
 * neutrals, but supplies links as a set or not at all.
 */

const DEFAULT_COPY = {
  productName: '',
  createTitle: 'Create a payment request',
  createSubtitle:
    'Set an amount and a release date. The buyer pays into escrow, and the funds move to you automatically on that date.',
  dashboardTitle: 'Your payments',
  dashboardSubtitle: 'Everything you have sent, received, or have waiting in escrow.',
  payTitle: 'Complete your payment',
  paySubtitle: 'Your money is held in escrow until the release date you can see below.',
  operatorNote: '',
} as const;

const DEFAULT_FEATURES = {
  onramp: true,
  qrPayment: true,
  earlyPayment: true,
} as const;

function mergeTheme(theme: PartialBrandTheme | undefined): BrandTheme {
  return {
    ...DEFAULT_THEME,
    ...theme,
    // Scales merge per-step, so a tenant can override 500 alone and keep a
    // usable ramp either side of it.
    primary: { ...DEFAULT_THEME.primary, ...(theme?.primary ?? {}) },
    secondary: { ...DEFAULT_THEME.secondary, ...(theme?.secondary ?? {}) },
    palettes: Object.fromEntries(
      (Object.keys(DEFAULT_THEME.palettes) as PaletteName[]).map((name) => [
        name,
        { ...DEFAULT_THEME.palettes[name], ...(theme?.palettes?.[name] ?? {}) },
      ])
    ) as BrandTheme['palettes'],
    button: { ...DEFAULT_THEME.button, ...(theme?.button ?? {}) },
  };
}

/** Asset ids from the white-label service become URLs; site paths pass through. */
function resolveAssets(config: BrandConfig): BrandAssets {
  const assets = config.assets ?? {};
  const url = (ref?: string) => (ref ? brandAssetUrl(config.id, ref) : undefined);
  return {
    ...assets,
    logo: url(assets.logo),
    logoDark: url(assets.logoDark),
    favicon: url(assets.favicon),
    ogImage: url(assets.ogImage),
  };
}

export function resolveBrand(config: BrandConfig): ResolvedBrand {
  const theme = mergeTheme(config.theme);
  return {
    ...config,
    theme,
    assets: resolveAssets(config),
    fonts: config.fonts && {
      ...config.fonts,
      faces: config.fonts.faces?.map((face) => ({ ...face, asset: brandAssetUrl(config.id, face.asset) })),
    },
    copy: {
      ...DEFAULT_COPY,
      // An unset productName means "use the brand name" — saying it twice in
      // every config is the kind of duplication that goes stale.
      productName: config.copy?.productName || config.name,
      ...Object.fromEntries(
        Object.entries(config.copy ?? {}).filter(([, v]) => v !== undefined && v !== '')
      ),
    } as ResolvedBrand['copy'],
    links: config.links ?? {},
    features: { ...DEFAULT_FEATURES, ...(config.features ?? {}) },
  };
}

/**
 * Identity function with a type annotation attached.
 *
 * Exists so a tenant's `brand.config.ts` gets completion and compile-time
 * checking without having to import and write out the BrandConfig type.
 */
export function defineBrand(config: BrandConfig): BrandConfig {
  return config;
}
