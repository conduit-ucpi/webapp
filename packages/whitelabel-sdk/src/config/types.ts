/**
 * The white-label configuration contract.
 *
 * Everything a tenant is allowed to change lives here. The rule of thumb for
 * what belongs: presentation and identity are configurable, anything that
 * affects what a contract does is not. A tenant can change the colour of the
 * pay button; a tenant cannot change the escrow terms, the fee, or the
 * verification the frontend performs before it will prompt for a signature.
 *
 * Colours are stored as space-separated RGB triples ("16 185 129") rather than
 * hex, because that is the form Tailwind needs in order to keep `/50` alpha
 * modifiers working through a CSS custom property:
 *
 *     primary: { 500: 'rgb(var(--wl-primary-500) / <alpha-value>)' }
 *
 * That indirection is what lets a tenant restyle the app without recompiling
 * Tailwind — the class names stay identical, only the variables change.
 */

/** "R G B", 0-255 each. e.g. "16 185 129" */
export type RgbTriple = string;

/** The 50–900 ramp Tailwind expects for a colour family. */
export interface ColorScale {
  50: RgbTriple;
  100: RgbTriple;
  200: RgbTriple;
  300: RgbTriple;
  400: RgbTriple;
  500: RgbTriple;
  600: RgbTriple;
  700: RgbTriple;
  800: RgbTriple;
  900: RgbTriple;
}

/**
 * The other colour families the components use by name (Tailwind's own `gray-*`, `blue-*`,
 * `red-*`…). They are themed the same way as primary and secondary, so a look can restyle every
 * colour on a page without the components changing; their defaults are Tailwind's stock values,
 * so a theme that leaves them alone looks exactly as it always has.
 *
 * success / warning / error carry only the steps tailwind.config.js has always defined (50, 500,
 * 600). Classes naming other steps have never produced CSS, and defining them would start
 * colouring elements that have always been uncoloured.
 */
export type PaletteName =
  | 'gray' | 'neutral' | 'red' | 'orange' | 'amber' | 'yellow' | 'green' | 'emerald'
  | 'blue' | 'indigo' | 'purple' | 'pink' | 'success' | 'warning' | 'error';

/** Step ("50" … "950") to RGB triple. */
export type Palette = Record<string, RgbTriple>;

/**
 * The primary button. Its own settings because it is not the accent colour: the app's main
 * action has always been dark neutral on light, light on dark. Values are CSS colours, so a
 * default can refer to a theme variable ("rgb(var(--wl-secondary-900))") and follow it.
 */
export interface ButtonTheme {
  radius: string;
  bg: string;
  fg: string;
  hoverBg: string;
  darkBg: string;
  darkFg: string;
  darkHoverBg: string;
}

export interface BrandTheme {
  /** Accent family: primary actions, links, active states. */
  primary: ColorScale;
  /** Neutral family: text, surfaces, borders. */
  secondary: ColorScale;
  /** Every other named colour family. See PaletteName. */
  palettes: Record<PaletteName, Palette>;
  /** `white` and `black` as used in classes (bg-white, text-black/50…). */
  white: RgbTriple;
  black: RgbTriple;
  /** CSS font stack for code and addresses (`font-mono`). */
  monoFontFamily: string;
  /** The accent face used for display lines and quotes (Newsreader in the default look). */
  accentFontFamily: string;
  button: ButtonTheme;
  /**
   * Corner radius applied to buttons, inputs and cards, as a CSS length.
   * A surprising amount of a brand's character sits here — '0' reads as
   * severe and technical, '1rem' as soft and consumer.
   */
  radius: string;
  /** CSS font stack for body copy. Include fallbacks; the host loads the face. */
  fontFamily: string;
  /** Optional display stack for headings. Defaults to `fontFamily`. */
  headingFontFamily?: string;
}

/** A theme as a tenant authors it: any subset, down to a single colour step. */
export type PartialBrandTheme = Partial<Omit<BrandTheme, 'primary' | 'secondary' | 'palettes' | 'button'>> & {
  primary?: Partial<ColorScale>;
  secondary?: Partial<ColorScale>;
  palettes?: Partial<Record<PaletteName, Palette>>;
  button?: Partial<ButtonTheme>;
};

export interface BrandAssets {
  /** Wordmark or logo for light surfaces. Falls back to the brand name as text. */
  logo?: string;
  /** Logo for dark surfaces. Defaults to `logo`. */
  logoDark?: string;
  /** Height the logo renders at, as a CSS length. Width stays proportional. */
  logoHeight?: string;
  favicon?: string;
  /** Open Graph / social preview image. */
  ogImage?: string;
}

/**
 * Strings a tenant may reasonably want to own.
 *
 * Deliberately a short list. Every entry is a string a customer sees and would
 * plausibly word differently; it is not a general translation layer. Anything
 * absent falls back to the SDK's own copy, so a tenant can override one line
 * without supplying all of them.
 */
export interface BrandCopy {
  /** Used wherever the product refers to itself. */
  productName?: string;
  createTitle?: string;
  createSubtitle?: string;
  dashboardTitle?: string;
  dashboardSubtitle?: string;
  payTitle?: string;
  paySubtitle?: string;
  /** Shown in the footer; keeps the operator of the escrow legible. */
  operatorNote?: string;
}

export interface BrandLinks {
  support?: string;
  terms?: string;
  privacy?: string;
  /** Dispute rules. Worth keeping reachable — it is the answer to the question a nervous payer has. */
  arbitration?: string;
}

export interface BrandFeatures {
  /** Show the fiat on-ramp in the pay flow. */
  onramp?: boolean;
  /** Offer QR payment alongside the connected-wallet path. */
  qrPayment?: boolean;
  /** Show the "get paid early" marketplace surfaces. */
  earlyPayment?: boolean;
}

export interface BrandConfig {
  /** Stable key. Used for logging and as the config cache key. */
  id: string;
  /** Display name. Used as the wordmark when no logo asset is supplied. */
  name: string;
  /** Optional line under the wordmark. */
  tagline?: string;
  /** BCP 47 tag, e.g. 'en' or 'es-VE'. Reserved for the locale work. */
  locale?: string;
  /**
   * Origin of the Node API. Empty string means same-origin, which is what the
   * box build wants; the static build sets it to the API host. Mirrors
   * NEXT_PUBLIC_API_BASE_URL so the two cannot disagree.
   */
  apiBaseUrl?: string;

  /**
   * Partial by design. Every field falls back to the SDK default, so a tenant
   * supplying only an accent ramp still gets a coherent neutral scale, a
   * radius and a font — rather than having to restate the whole theme to
   * change one colour.
   */
  theme?: PartialBrandTheme;
  assets?: BrandAssets;
  copy?: BrandCopy;
  links?: BrandLinks;
  features?: BrandFeatures;
}

/** A config with every optional branch filled in, as the components consume it. */
export interface ResolvedBrand extends Omit<BrandConfig, 'theme'> {
  theme: BrandTheme;
  assets: BrandAssets;
  copy: Required<BrandCopy>;
  links: BrandLinks;
  features: Required<BrandFeatures>;
}
