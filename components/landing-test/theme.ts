/**
 * A landing-test page's look, as CSS custom properties.
 *
 * The shared widgets (nav, estimator, audience tabs, embed examples, footer) know nothing
 * about Stripe green or Wise green: they read `var(--lt-*)` and the page sets the values.
 * That is what lets five pages share one estimator and still look nothing alike. Dark mode
 * is a second set of the same variables, applied under the app's `.dark` class.
 */
export interface LandingTheme {
  /** Page background. */
  bg: string;
  /** Body text. */
  fg: string;
  /** Secondary text. */
  muted: string;
  /** Card surface. */
  card: string;
  /** Hairlines and card borders. */
  border: string;
  /** The one accent: primary buttons, highlights. */
  accent: string;
  /** Text on the accent. */
  accentFg: string;
  /** A soft tint of the accent, for chips and hover. */
  accentSoft: string;
  /** Corner radius of cards. */
  radius: string;
  /** Corner radius of buttons (Wise pills vs Stripe rounded rects). */
  btnRadius: string;
  /** Body font stack. */
  font: string;
  /** Display font stack (headlines). */
  fontDisplay: string;
  /** Code font stack. */
  fontMono: string;
}

const KEYS: Record<keyof LandingTheme, string> = {
  bg: '--lt-bg',
  fg: '--lt-fg',
  muted: '--lt-muted',
  card: '--lt-card',
  border: '--lt-border',
  accent: '--lt-accent',
  accentFg: '--lt-accent-fg',
  accentSoft: '--lt-accent-soft',
  radius: '--lt-radius',
  btnRadius: '--lt-btn-radius',
  font: '--lt-font',
  fontDisplay: '--lt-font-display',
  fontMono: '--lt-font-mono',
};

function declarations(theme: LandingTheme): string {
  return (Object.keys(KEYS) as Array<keyof LandingTheme>)
    .map((k) => `${KEYS[k]}: ${theme[k]};`)
    .join(' ');
}

/**
 * The stylesheet a page drops into a <style> tag: light values on the page root, dark
 * values when the app's theme class is set. Scoped by id so two landings can never bleed
 * into each other or into the rest of the app.
 */
export function themeCss(id: string, light: LandingTheme, dark: LandingTheme): string {
  return `#${id} { ${declarations(light)} } .dark #${id} { ${declarations(dark)} }`;
}

/* Tailwind class strings the shared widgets use, so a theme change is a variable change. */
export const lt = {
  bg: 'bg-[color:var(--lt-bg)]',
  fg: 'text-[color:var(--lt-fg)]',
  muted: 'text-[color:var(--lt-muted)]',
  card: 'bg-[color:var(--lt-card)]',
  border: 'border-[color:var(--lt-border)]',
  accentText: 'text-[color:var(--lt-accent)]',
  accentBg: 'bg-[color:var(--lt-accent)]',
  accentSoft: 'bg-[color:var(--lt-accent-soft)]',
  radius: 'rounded-[var(--lt-radius)]',
  btnRadius: 'rounded-[var(--lt-btn-radius)]',
  /** THE call to action. One look everywhere: filled accent, semibold, generous hit area. */
  btnPrimary:
    'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[15px] font-semibold whitespace-nowrap rounded-[var(--lt-btn-radius)] bg-[color:var(--lt-accent)] text-[color:var(--lt-accent-fg)] shadow-sm transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lt-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--lt-bg)]',
  /** The other action. Same size and shape as the primary, outlined instead of filled. */
  btnSecondary:
    'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[15px] font-semibold whitespace-nowrap rounded-[var(--lt-btn-radius)] border-2 border-[color:var(--lt-border)] text-[color:var(--lt-fg)] bg-transparent transition-colors hover:border-[color:var(--lt-accent)] hover:bg-[color:var(--lt-accent-soft)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lt-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--lt-bg)]',
  /** Compact variant for tight spots (nav, cards). Append after btnPrimary/btnSecondary. */
  btnSm: '!px-4 !py-2 !text-sm',
  /** @deprecated alias kept for 01–05; new pages use btnSecondary. */
  get btnOutline() {
    return this.btnSecondary;
  },
  btnGhost:
    'inline-flex items-center gap-1.5 text-sm text-[color:var(--lt-muted)] hover:text-[color:var(--lt-fg)] transition-colors',
};
