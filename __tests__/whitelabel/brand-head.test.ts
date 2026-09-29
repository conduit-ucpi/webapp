/**
 * The brand's fonts and favicon go into <head>. Whatever a config says, only a
 * Google Fonts stylesheet is linked, and a face's name or URL cannot end its
 * @font-face rule.
 */
import { applyBrandHead, fontFaceCss, safeFontsHref, resolveBrand } from '@conduit-ucpi/whitelabel-sdk';

describe('brand <head>', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('links only Google Fonts stylesheets', () => {
    expect(safeFontsHref('https://fonts.googleapis.com/css2?family=Manrope')).toContain('fonts.googleapis.com');
    expect(safeFontsHref('https://fonts.googleapis.com.evil.example/x.css')).toBeNull();
    expect(safeFontsHref('http://fonts.googleapis.com/css')).toBeNull();
    expect(safeFontsHref('javascript:alert(1)')).toBeNull();
  });

  it('writes @font-face rules that cannot be broken out of', () => {
    const brand = resolveBrand({
      id: 'cobro',
      name: 'COBRO',
      fonts: { faces: [{ family: 'X"; } body { display:none } @font-face { font-family: "Y', asset: '65f0c0ffee0000000000abcd' }] },
    });
    const css = fontFaceCss(brand);
    expect(css.match(/[{}]/g)).toHaveLength(2);
    expect(css).toContain('/api/brands/cobro/assets/65f0c0ffee0000000000abcd');
  });

  it('adds, replaces and removes the brand elements as the brand changes', () => {
    applyBrandHead(
      resolveBrand({ id: 'a', name: 'A', fonts: { stylesheetHref: 'https://fonts.googleapis.com/css2?family=A' }, assets: { favicon: '/a.ico' } }),
      document
    );
    expect(document.querySelectorAll('#wl-brand-fonts')).toHaveLength(1);
    expect(document.getElementById('wl-brand-favicon')?.getAttribute('href')).toBe('/a.ico');

    applyBrandHead(resolveBrand({ id: 'b', name: 'B' }), document);
    expect(document.getElementById('wl-brand-fonts')).toBeNull();
    expect(document.getElementById('wl-brand-favicon')).toBeNull();
  });
});
