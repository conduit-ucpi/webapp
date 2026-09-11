import { en } from './en';
import { es } from './es';
import type { Locale } from '../resolveLocale';
import type { Catalogue } from './en';

export const CATALOGUES: Record<Locale, Catalogue> = { en, es };
export { en, es };
export type { MessageKey, Catalogue } from './en';
