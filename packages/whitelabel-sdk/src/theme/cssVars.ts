import { BrandTheme, ResolvedBrand } from '../config/types';

/**
 * Turn a resolved brand into CSS custom properties.
 *
 * This is the hinge the whole theming design turns on. Tailwind compiles class
 * names at build time, so `bg-primary-500` cannot become a tenant's colour by
 * generating a new class — but it can if the class resolves to a variable and
 * the variable changes. tailwind.config.js maps each colour step to
 * `rgb(var(--wl-primary-500) / <alpha-value>)`, so every existing class in the
 * app follows the tenant theme with no component changes and no rebuild.
 *
 * The defaults are also written into globals.css at :root. That matters for the
 * static build: the HTML is painted before any JavaScript runs, so without a
 * static baseline the first frame would be unstyled. The provider only writes
 * variables that differ from that baseline.
 */

export const VAR_PREFIX = '--wl';

/** Flat map of custom property name -> value for a theme. */
export function themeToVars(theme: BrandTheme): Record<string, string> {
  const vars: Record<string, string> = {};

  (['primary', 'secondary'] as const).forEach((family) => {
    Object.entries(theme[family]).forEach(([step, triple]) => {
      vars[`${VAR_PREFIX}-${family}-${step}`] = triple;
    });
  });

  vars[`${VAR_PREFIX}-radius`] = theme.radius;
  vars[`${VAR_PREFIX}-font`] = theme.fontFamily;
  vars[`${VAR_PREFIX}-font-heading`] = theme.headingFontFamily ?? theme.fontFamily;

  return vars;
}

/** Everything themeable, including the bits outside the colour ramps. */
export function brandToVars(brand: ResolvedBrand): Record<string, string> {
  const vars = themeToVars(brand.theme);
  if (brand.assets.logoHeight) {
    vars[`${VAR_PREFIX}-logo-height`] = brand.assets.logoHeight;
  }
  return vars;
}

/**
 * Render a `:root { … }` block. Used to bake the default theme into globals.css
 * so the first paint is correct without JavaScript.
 */
export function varsToCssBlock(vars: Record<string, string>, selector = ':root'): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * Apply variables to an element, writing only what differs from what is already
 * computed. A tenant overriding one accent should not restate the whole ramp
 * into the style attribute.
 */
export function applyVars(vars: Record<string, string>, el: HTMLElement): void {
  const computed = getComputedStyle(el);
  Object.entries(vars).forEach(([name, value]) => {
    if (computed.getPropertyValue(name).trim() !== value.trim()) {
      el.style.setProperty(name, value);
    }
  });
}
