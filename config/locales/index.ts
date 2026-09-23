import { createTranslator } from '@conduit-ucpi/whitelabel-sdk';
import { pagesEn } from './en';
import { pagesEs } from './es';

/**
 * Translate copy belonging to this deployment's own pages.
 *
 * Reads the same resolved locale as the SDK's useT(), so a page and the SDK
 * components inside it can never disagree about what language they are in.
 * Use useT() for anything the SDK ships and usePageT() for our own copy; the
 * split is about who owns the words, not which screen they appear on.
 */
export const usePageT = createTranslator({ en: pagesEn, es: pagesEs });

export { pagesEn, pagesEs };
export type { PagesMessageKey } from './en';
