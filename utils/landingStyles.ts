/**
 * Shared button class strings for landing pages and standalone pages
 * that use raw <button> elements instead of the Button component.
 *
 * These match the flat dark/white aesthetic used across the site.
 */

const btn = 'inline-flex items-center justify-center font-medium tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 focus-visible:ring-offset-2';

export const btnPrimary = `${btn} text-[15px] bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 hover:bg-secondary-700 dark:hover:bg-secondary-100 px-8 py-3.5`;

export const btnOutline = `${btn} text-[15px] border border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-800 px-8 py-3.5`;
