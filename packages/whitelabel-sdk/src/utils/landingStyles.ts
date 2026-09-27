/**
 * Shared button class strings for landing pages and standalone pages
 * that use raw <button> elements instead of the Button component.
 *
 * The primary one wears the theme's button settings (BrandTheme.button), the same as the
 * Button component, so a look restyles both.
 */

const btn = 'inline-flex items-center justify-center rounded-[var(--wl-button-radius)] font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2';

export const btnPrimary = `${btn} text-[15px] bg-[color:var(--wl-button-bg)] text-[color:var(--wl-button-fg)] hover:bg-[color:var(--wl-button-hover-bg)] dark:bg-[color:var(--wl-button-dark-bg)] dark:text-[color:var(--wl-button-dark-fg)] dark:hover:bg-[color:var(--wl-button-dark-hover-bg)] px-8 py-3.5`;

export const btnOutline = `${btn} text-[15px] border border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-800 px-8 py-3.5`;
