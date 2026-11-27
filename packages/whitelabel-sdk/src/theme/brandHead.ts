import { ResolvedBrand } from '../config/types';

/**
 * The parts of a brand that live in <head> rather than in CSS variables: the
 * font faces its theme names, and its favicon.
 *
 * Each is a single element with a fixed id, replaced when the brand changes and
 * removed when the new brand has none, so switching brand never leaves the last
 * one's fonts or icon behind.
 */

const FONTS_LINK_ID = 'wl-brand-fonts';
const FONT_FACES_ID = 'wl-brand-font-faces';
const FAVICON_ID = 'wl-brand-favicon';
const GOOGLE_FONTS_HOST = 'fonts.googleapis.com';

/** Only a Google Fonts stylesheet is ever linked, whatever a config says. */
export function safeFontsHref(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname === GOOGLE_FONTS_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

/** `@font-face` rules for a brand's uploaded faces. Names and URLs are stripped of anything that could end the rule. */
export function fontFaceCss(brand: ResolvedBrand): string {
  const clean = (v: string) => v.replace(/["'\\;{}<>\n\r]/g, '');
  return (brand.fonts?.faces ?? [])
    .map((face) => {
      const weight = face.weight && /^[1-9]00( [1-9]00)?$/.test(face.weight) ? face.weight : '400';
      const style = face.style === 'italic' ? 'italic' : 'normal';
      return (
        `@font-face { font-family: "${clean(face.family)}"; src: url("${clean(face.asset)}") format("woff2"); ` +
        `font-weight: ${weight}; font-style: ${style}; font-display: swap; }`
      );
    })
    .join('\n');
}

function upsert<T extends HTMLElement>(doc: Document, id: string, create: () => T): T {
  const existing = doc.getElementById(id) as T | null;
  if (existing) return existing;
  const el = create();
  el.id = id;
  doc.head.appendChild(el);
  return el;
}

function remove(doc: Document, id: string) {
  doc.getElementById(id)?.remove();
}

export function applyBrandHead(brand: ResolvedBrand, doc: Document = document): void {
  const href = safeFontsHref(brand.fonts?.stylesheetHref);
  if (href) {
    const link = upsert(doc, FONTS_LINK_ID, () => doc.createElement('link'));
    link.setAttribute('rel', 'stylesheet');
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  } else {
    remove(doc, FONTS_LINK_ID);
  }

  const faces = fontFaceCss(brand);
  if (faces) {
    const style = upsert(doc, FONT_FACES_ID, () => doc.createElement('style'));
    if (style.textContent !== faces) style.textContent = faces;
  } else {
    remove(doc, FONT_FACES_ID);
  }

  // The page's own <link rel="icon"> stays in place as the fallback; a brand's
  // icon is added after it, which browsers prefer.
  if (brand.assets.favicon) {
    const icon = upsert(doc, FAVICON_ID, () => doc.createElement('link'));
    icon.setAttribute('rel', 'icon');
    if (icon.getAttribute('href') !== brand.assets.favicon) icon.setAttribute('href', brand.assets.favicon);
  } else {
    remove(doc, FAVICON_ID);
  }
}
